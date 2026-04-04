"""
Flask Backend - SQLite
Basitleştirilmiş Demo
"""

from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import sqlite3
from datetime import datetime
import joblib
import json
import csv

app = Flask(__name__, static_folder='public', static_url_path='')
CORS(app)

DB_PATH = 'nilufer_waste.db'
MODEL_PATH = 'models/fill_predictor.pkl'
JSON_NEIGHBORHOODS_PATH = 'data/containers_by_neighborhood.json'
CSV_ADDRESS_BASED_PATH = 'data/adres_bazli.csv'

# Model yükle
model_data = None
try:
    model_data = joblib.load(MODEL_PATH)
    print(f"[OK] Model loaded")
except:
    print(f"[WARN] Model not found")


# ============== JSON VE CSV GÜNCELLEME FONKSİYONLARI ==============

def update_json_neighborhood_grouping():
    """JSON dosyasını (containers_by_neighborhood.json) güncelle"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Tüm konteynerleri mahallelerine göre grupla
        cursor.execute("""
            SELECT n.neighborhood_id, n.neighborhood_name, c.container_id, 
                   c.container_type, c.capacity_liters, c.current_fill_level, c.status
            FROM containers c
            INNER JOIN neighborhoods n ON c.neighborhood_id = n.neighborhood_id
            ORDER BY n.neighborhood_name, c.container_id
        """)
        
        results = cursor.fetchall()
        conn.close()
        
        # Veriyi mahalle bazında grupla
        neighborhoods_data = {}
        
        for neighborhood_id, neighborhood_name, container_id, container_type, capacity, fill_level, status in results:
            if neighborhood_name not in neighborhoods_data:
                neighborhoods_data[neighborhood_name] = {
                    'neighborhood_id': neighborhood_id,
                    'container_count': 0,
                    'containers': []
                }
            
            neighborhoods_data[neighborhood_name]['container_count'] += 1
            neighborhoods_data[neighborhood_name]['containers'].append({
                'id': container_id,
                'type': container_type,
                'capacity_liters': capacity,
                'fill_level': fill_level,
                'status': status
            })
        
        # JSON dosyasına yaz
        with open(JSON_NEIGHBORHOODS_PATH, 'w', encoding='utf-8') as f:
            json.dump(neighborhoods_data, f, ensure_ascii=False, indent=2)
        
        print(f"[OK] JSON file updated: {JSON_NEIGHBORHOODS_PATH}")
        return True
    except Exception as e:
        print(f"[ERROR] JSON update error: {e}")
        return False

def update_csv_address_based():
    """CSV dosyasını (adres_bazli.csv) güncelle"""
    try:
        # JSON dosyasını oku
        with open(JSON_NEIGHBORHOODS_PATH, 'r', encoding='utf-8') as f:
            neighborhoods_data = json.load(f)
        
        # CSV dosyasına yazmak için veri hazırla
        csv_rows = []
        
        for neighborhood_name in sorted(neighborhoods_data.keys()):
            data = neighborhoods_data[neighborhood_name]
            neighborhood_id = data['neighborhood_id']
            
            for container in data['containers']:
                csv_rows.append({
                    'MAHALLE': neighborhood_name,
                    'MAHALLE_ID': neighborhood_id,
                    'KONTEYNER_ID': container['id'],
                    'TUR': container['type'],
                    'KAPASITE_LITRE': container['capacity_liters'],
                    'DOLULIK_SEVIYESI': round(container['fill_level'] * 100, 2),
                    'DURUM': container['status']
                })
        
        # CSV dosyasına yaz
        with open(CSV_ADDRESS_BASED_PATH, 'w', newline='', encoding='utf-8') as f:
            fieldnames = ['MAHALLE', 'MAHALLE_ID', 'KONTEYNER_ID', 'TUR', 'KAPASITE_LITRE', 'DOLULIK_SEVIYESI', 'DURUM']
            writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter=';')
            
            writer.writeheader()
            writer.writerows(csv_rows)
        
        print(f"[OK] CSV file updated: {CSV_ADDRESS_BASED_PATH}")
        return True
    except Exception as e:
        print(f"[ERROR] CSV update error: {e}")
        return False

def add_admin_log(action, report_id=None, target_user_id=None, target_container_id=None, old_value=None, new_value=None):
    """Admin işlemini logs tablosuna kaydet"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO admin_logs (action, report_id, target_user_id, target_container_id, old_value, new_value, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (action, report_id, target_user_id, target_container_id, old_value, new_value, datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"[ERROR] Admin log error: {e}")
        return False

@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/admin')
def admin():
    return send_from_directory('public', 'admin.html')

@app.route('/api/dashboard/stats')
def dashboard_stats():
    """Dashboard istatistikleri - Gerçek veritabanı verileri"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Toplam konteyner
    cursor.execute("SELECT COUNT(*) FROM containers WHERE status='active'")
    total = cursor.fetchone()[0]
    
    # Dolu konteynerler
    cursor.execute("SELECT COUNT(*) FROM containers WHERE current_fill_level >= 0.75")
    full = cursor.fetchone()[0]
    
    # Ortalama doluluk oranı (TÜM KONTEYNERLƏRIN)
    cursor.execute("SELECT AVG(current_fill_level) FROM containers WHERE status='active'")
    avg_fill_level = cursor.fetchone()[0] or 0
    
    # Toplam araç
    cursor.execute("SELECT COUNT(*) FROM vehicles")
    vehicles = cursor.fetchone()[0]
    
    # Mahalleler
    cursor.execute("SELECT COUNT(*) FROM neighborhoods")
    neighborhoods = cursor.fetchone()[0]
    
    # Bugünkü bildirimler (gerçek veri)
    cursor.execute("""
        SELECT COUNT(*) FROM citizen_reports 
        WHERE DATE(timestamp) = DATE('now')
    """)
    today_reports = cursor.fetchone()[0]
    
    # Bugünkü toplama olayları (gerçek veri)
    cursor.execute("""
        SELECT COUNT(*) FROM collection_events 
        WHERE DATE(collection_date) = DATE('now')
    """)
    today_collections = cursor.fetchone()[0]
    
    # Bu ay tonaj (gerçek veri - tonnage_statistics tablosundan)
    cursor.execute("""
        SELECT total_tonnage FROM tonnage_statistics 
        ORDER BY rowid DESC LIMIT 1
    """)
    tonnage_row = cursor.fetchone()
    month_tonnage = tonnage_row[0] if tonnage_row else 0
    
    # Toplam bildiri sayısı
    cursor.execute("SELECT COUNT(*) FROM citizen_reports")
    total_reports = cursor.fetchone()[0]
    
    # Doğrulanmış bildiri sayısı
    cursor.execute("SELECT COUNT(*) FROM citizen_reports WHERE is_verified = 1")
    verified_reports = cursor.fetchone()[0]
    
    conn.close()
    
    return jsonify({
        'total_containers': total,
        'full_containers': full,
        'fill_rate': avg_fill_level,  # Ortalama doluluk oranı
        'total_vehicles': vehicles,
        'neighborhoods': neighborhoods,
        'today_reports': today_reports,
        'today_collections': today_collections,
        'month_tonnage': float(month_tonnage),
        'total_reports': total_reports,
        'verified_reports': verified_reports,
        'verification_rate': verified_reports / total_reports if total_reports > 0 else 0
    })

@app.route('/api/leaderboard')
def leaderboard():
    """Kullanıcı liderlik tablosu"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT name, trust_score, total_reports
        FROM users
        WHERE role = 'citizen' AND total_reports > 0
        ORDER BY trust_score DESC, total_reports DESC
        LIMIT 10
    """)
    
    users = cursor.fetchall()
    conn.close()
    
    return jsonify({
        'leaderboard': [
            {
                'rank': idx + 1,
                'name': u[0],
                'trust_score': float(u[1]),
                'total_reports': u[2]
            }
            for idx, u in enumerate(users)
        ]
    })

# ============== ADMIN ENDPOINTS ==============
@app.route('/api/admin/neighborhoods')
def admin_get_neighborhoods():
    """Admin paneli için mahalle listesi"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT neighborhood_id, neighborhood_name
            FROM neighborhoods
            ORDER BY neighborhood_name
        """)
        neighborhoods = [
            {'id': row[0], 'name': row[1]} 
            for row in cursor.fetchall()
        ]
        conn.close()
        return jsonify({'neighborhoods': neighborhoods})
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/containers-list')
def admin_get_containers_list():
    """Admin paneli için konteyner listesi"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT container_id
            FROM containers
            ORDER BY container_id
        """)
        containers = [{'id': row[0]} for row in cursor.fetchall()]
        conn.close()
        return jsonify({
            'total': len(containers),
            'containers': containers
        })
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/predict/<int:container_id>')
def predict_container(container_id):
    """Tek konteyner tahmini - Gerçek ML modeli ile"""
    if not model_data:
        return jsonify({'error': 'Model yüklü değil'}), 503
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Konteyner bilgilerini ve tarihsel verileri çek
    cursor.execute("""
        SELECT 
            c.container_id,
            c.container_type,
            c.capacity_liters,
            c.last_collection_date,
            c.current_fill_level,
            c.latitude,
            c.longitude,
            n.neighborhood_name,
            n.population,
            n.population_density,
            n.area_km2
        FROM containers c
        LEFT JOIN neighborhoods n ON c.neighborhood_id = n.neighborhood_id
        WHERE c.container_id = ?
    """, (container_id,))
    
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return jsonify({'error': 'Konteyner bulunamadı'}), 404
    
    # Tarihsel toplama verilerini çek (gerçek veri)
    cursor.execute("""
        SELECT 
            AVG(tonnage_collected) as avg_tonnage,
            AVG(fill_level_before) as avg_fill_before,
            COUNT(*) as collection_count
        FROM collection_events
        WHERE container_id = ?
    """, (container_id,))
    
    historical = cursor.fetchone()
    avg_tonnage = historical[0] if historical and historical[0] else 0.5
    avg_fill_before = historical[1] if historical and historical[1] else 0.5
    collection_count = historical[2] if historical and historical[2] else 10
    
    conn.close()
    
    # Özellikleri oluştur (gerçek verilerle)
    if row[3]:
        try:
            last_date = datetime.fromisoformat(row[3])
            hours_since = (datetime.now() - last_date).total_seconds() / 3600
        except:
            hours_since = 168
    else:
        hours_since = 168
    
    days_since = hours_since / 24
    now = datetime.now()
    day_of_week = now.weekday()
    is_weekend = int(now.weekday() >= 5)
    month = now.month
    season = (month % 12) // 3
    
    capacity = row[2] or 770
    container_type_map = {'underground': 4, '770lt': 3, '400lt': 2, 'plastic': 1}
    container_type_encoded = container_type_map.get(row[1], 2)
    
    population = row[8] if row[8] else 10000
    pop_density = row[9] if row[9] else 5000
    area = row[10] if row[10] else 2.0
    
    # Kapasite kullanım oranı (gerçek veri)
    capacity_usage_rate = avg_tonnage / (capacity / 1000) if capacity > 0 else 0.5
    
    features = [
        hours_since, days_since, day_of_week, is_weekend, month, season,
        capacity, container_type_encoded, population, pop_density, area,
        avg_tonnage, avg_fill_before, collection_count, capacity_usage_rate
    ]
    
    # Tahmin
    model = model_data['model']
    probabilities = model.predict_proba([features])[0]
    fill_probability = probabilities[1]
    
    return jsonify({
        'container_id': container_id,
        'neighborhood': row[7],
        'container_type': row[1],
        'capacity_liters': row[2],
        'current_fill_level': float(row[4]),
        'fill_probability': float(fill_probability),
        'is_full': bool(fill_probability >= 0.75),
        'confidence': float(max(probabilities)),
        'latitude': float(row[5]),
        'longitude': float(row[6]),
        'model_version': model_data['version'],
        'prediction_timestamp': datetime.now().isoformat()
    })

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Kullanıcı kaydı - TC numarası ile"""
    from flask import request
    from werkzeug.security import generate_password_hash
    
    data = request.json
    
    required = ['name', 'tc_number', 'phone', 'password']
    if not all(k in data for k in required):
        return jsonify({'error': 'Tüm alanları doldurun'}), 400
    
    # TC numarası doğrulama (11 haneli)
    tc = str(data['tc_number']).strip()
    if len(tc) != 11 or not tc.isdigit():
        return jsonify({'error': 'TC numarası 11 haneli olmalıdır'}), 400
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # TC kontrolü
    cursor.execute("SELECT user_id FROM users WHERE tc_number = ?", (tc,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Bu TC numarası zaten kayıtlı'}), 400
    
    # Şifre hash
    password_hash = generate_password_hash(data['password'])
    
    # Kullanıcıyı kaydet (email TC numarasından oluşturulur)
    email = f"{tc}@nilufer.local"
    cursor.execute("""
        INSERT INTO users (name, email, tc_number, phone, password_hash, role, trust_score)
        VALUES (?, ?, ?, ?, ?, 'citizen', 0.5)
    """, (data['name'], email, tc, data['phone'], password_hash))
    
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()
    
    return jsonify({
        'success': True,
        'user_id': user_id,
        'message': 'Kayıt başarılı! Şimdi giriş yapabilirsiniz.'
    })

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Kullanıcı girişi - TC numarası ile"""
    from flask import request
    from werkzeug.security import check_password_hash
    
    data = request.json
    
    if not data.get('tc_number') or not data.get('password'):
        return jsonify({'error': 'TC numarası ve şifre gerekli'}), 400
    
    tc = str(data['tc_number']).strip()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT user_id, name, tc_number, password_hash, role, trust_score, total_reports
        FROM users WHERE tc_number = ?
    """, (tc,))
    
    user = cursor.fetchone()
    conn.close()
    
    if not user or not check_password_hash(user[3], data['password']):
        return jsonify({'error': 'TC numarası veya şifre hatalı'}), 401
    
    return jsonify({
        'success': True,
        'user': {
            'id': user[0],
            'name': user[1],
            'tc_number': user[2],
            'role': user[4],
            'trust_score': float(user[5]),
            'total_reports': user[6]
        }
    })

@app.route('/api/containers/full')
def full_containers():
    """Dolu konteynerleri listele"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            c.container_id,
            c.container_type,
            c.current_fill_level,
            c.latitude,
            c.longitude,
            n.neighborhood_name
        FROM containers c
        LEFT JOIN neighborhoods n ON c.neighborhood_id = n.neighborhood_id
        WHERE c.current_fill_level >= 0.75
        ORDER BY c.current_fill_level DESC
        LIMIT 50
    """)
    
    containers = cursor.fetchall()
    conn.close()
    
    return jsonify({
        'count': len(containers),
        'containers': [
            {
                'id': c[0],
                'type': c[1],
                'fill_level': float(c[2]),
                'latitude': float(c[3]),
                'longitude': float(c[4]),
                'neighborhood': c[5]
            }
            for c in containers
        ]
    })

@app.route('/api/containers/all')
def all_containers():
    """Tüm konteynerleri listele"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            c.container_id,
            c.container_type,
            c.current_fill_level,
            c.latitude,
            c.longitude,
            c.capacity_liters,
            c.status,
            n.neighborhood_name
        FROM containers c
        LEFT JOIN neighborhoods n ON c.neighborhood_id = n.neighborhood_id
        WHERE c.status = 'active'
        ORDER BY c.container_id ASC
    """)
    
    containers = cursor.fetchall()
    conn.close()
    
    return jsonify({
        'count': len(containers),
        'containers': [
            {
                'id': c[0],
                'type': c[1],
                'fill_level': float(c[2]),
                'latitude': float(c[3]),
                'longitude': float(c[4]),
                'capacity': c[5],
                'status': c[6],
                'neighborhood': c[7]
            }
            for c in containers
        ]
    })

@app.route('/api/reports/submit', methods=['POST'])
def submit_report():
    """Vatandaş bildirimi gönder"""
    from flask import request
    import base64
    import os
    import uuid
    
    data = request.json
    
    # Zorunlu alanlar
    if not all(k in data for k in ['user_id', 'container_id', 'fill_level']):
        return jsonify({'error': 'Eksik bilgi'}), 400
    
    # Fotoğraf ZORUNLU - kontrol et
    photo_base64 = data.get('photo_data', '').strip()
    if not photo_base64:
        return jsonify({'error': 'Fotoğraf zorunludur!'}), 400
    
    user_id = data['user_id']
    container_id = data['container_id']
    fill_level = float(data['fill_level']) / 100.0  # Yüzdeyi 0-1 arasına çevir
    notes = data.get('notes', '')
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Kullanıcı bilgilerini al
    cursor.execute("SELECT trust_score, total_reports FROM users WHERE user_id = ?", (user_id,))
    user_info = cursor.fetchone()
    
    if not user_info:
        conn.close()
        return jsonify({'error': 'Kullanıcı bulunamadı'}), 404
    
    current_trust = user_info[0]
    total_reports = user_info[1] if user_info[1] else 0
    
    # Konteyner mevcut doluluk seviyesini al
    cursor.execute("SELECT current_fill_level FROM containers WHERE container_id = ?", (container_id,))
    container_info = cursor.fetchone()
    
    if not container_info:
        conn.close()
        return jsonify({'error': 'Konteyner bulunamadı'}), 404
    
    actual_fill = container_info[0]
    
    # Doğruluk hesapla (fark ne kadar küçükse o kadar doğru)
    accuracy = 1.0 - abs(fill_level - actual_fill)
    accuracy = max(0.0, min(1.0, accuracy))  # 0-1 arası sınırla
    
    # Resmi base64'ten döndür ve kaydet
    photo_url = None
    try:
        # photos klasörünü oluştur
        photos_dir = os.path.join('public', 'photos')
        os.makedirs(photos_dir, exist_ok=True)
        
        # Base64 çöz
        if photo_base64.startswith('data:image'):
            photo_base64 = photo_base64.split(',')[1]
        
        photo_bytes = base64.b64decode(photo_base64)
        
        # Benzersiz dosya adı
        filename = f"report_{uuid.uuid4().hex[:8]}.jpg"
        filepath = os.path.join(photos_dir, filename)
        
        # Resmi kaydet
        with open(filepath, 'wb') as f:
            f.write(photo_bytes)
        
        photo_url = f"/photos/{filename}"
    except Exception as e:
        print(f"[ERROR] Photo save error: {e}")
        photo_url = None
    
    # HER ZAMAN PENDING OLARAK KAYDET - Admin onaylayana kadar değişmesin
    is_verified = 0  # Sadece admin onaylayabilir
    
    # Bildirimi kaydet (citizen_reports tablosu kullan)
    cursor.execute("""
        INSERT INTO citizen_reports 
        (user_id, container_id, fill_level, notes, timestamp, report_status, has_photo, photo_url, is_verified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (user_id, container_id, fill_level, notes, datetime.now().isoformat(), 0, True, photo_url, is_verified))
    
    # Sadece total_reports güncelle - trust_score admin onaylama sırasında değişecek
    cursor.execute("""
        UPDATE users 
        SET total_reports = total_reports + 1
        WHERE user_id = ?
    """, (user_id,))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': True,
        'message': 'Bildirim başarıyla kaydedildi! Admin tarafından incelenecek.',
        'report_status': 'pending',
        'accuracy': round(accuracy * 100, 1),
        'trust_score': round(current_trust, 2),
        'total_reports': total_reports + 1,
        'trust_change': 0
    })

@app.route('/api/simulate', methods=['POST'])
def simulate():
    """Basit simülasyon - Gerçek verilerle"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM containers WHERE current_fill_level >= 0.75")
    full_containers = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM vehicles")
    total_vehicles = cursor.fetchone()[0]
    
    # Araç tipleri ve sayıları
    cursor.execute("""
        SELECT vt.type_name, COUNT(v.vehicle_id) as count
        FROM vehicles v
        JOIN vehicle_types vt ON v.type_id = vt.type_id
        GROUP BY vt.type_name
    """)
    vehicle_counts = {row[0]: row[1] for row in cursor.fetchall()}
    
    conn.close()
    
    # Gerçek hesaplama
    small_count = vehicle_counts.get('Küçük Çöp Kamyonu', 0)
    large_count = vehicle_counts.get('Büyük Çöp Kamyonu', 0)
    crane_count = vehicle_counts.get('Vinçli Araç', 0)
    
    # Kapasite: küçük 4.5t, büyük 8t, vinçli 11.5t
    total_capacity = (small_count * 4.5 + large_count * 8 + crane_count * 11.5) * 8  # 8 saat
    
    estimated_hours = (full_containers * 0.5 / total_capacity) * 8 if total_capacity > 0 else 24
    estimated_cost = small_count * 500 + large_count * 800 + crane_count * 400
    
    return jsonify({
        'success': True,
        'results': {
            'total_vehicles': total_vehicles,
            'small_trucks': small_count,
            'large_trucks': large_count,
            'crane_vehicles': crane_count,
            'estimated_hours': round(estimated_hours, 2),
            'estimated_cost': estimated_cost,
            'containers_to_collect': full_containers,
            'efficiency': min(100, 100 - (estimated_hours / 24 * 100))
        }
    })

@app.route('/api/tonnage/monthly')
def tonnage_monthly():
    """Aylık tonaj verileri - Gerçek CSV verilerinden"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Son 12 ay tonaj verisi
    cursor.execute("""
        SELECT month, surface_tonnage, underground_tonnage, total_tonnage
        FROM tonnage_statistics
        ORDER BY rowid DESC
        LIMIT 12
    """)
    tonnage_data = cursor.fetchall()
    
    if tonnage_data:
        # Ortalama günlük tonaj hesapla
        total_monthly = sum(row[3] for row in tonnage_data if row[3]) / len(tonnage_data)
        avg_daily_tonnage = total_monthly / 30
        
        # Ortalama km (araç sayısına göre tahmin)
        cursor.execute("SELECT COUNT(*) FROM vehicles WHERE status='active'")
        vehicle_count = cursor.fetchone()[0]
        avg_daily_km = vehicle_count * 4  # Araç başına günde ortalama 4 km
    else:
        avg_daily_tonnage = 550
        avg_daily_km = 180
    
    conn.close()
    
    return jsonify({
        'monthly_data': [
            {
                'month': row[0],
                'surface_tonnage': row[1],
                'underground_tonnage': row[2],
                'total_tonnage': row[3]
            }
            for row in tonnage_data
        ],
        'avg_daily_tonnage': round(avg_daily_tonnage, 2),
        'avg_daily_km': round(avg_daily_km, 2)
    })

@app.route('/api/user/<int:user_id>/stats')
def user_stats(user_id):
    """Kullanıcı istatistikleri"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT name, trust_score, total_reports, accurate_reports
        FROM users WHERE user_id = ?
    """, (user_id,))
    
    user = cursor.fetchone()
    conn.close()
    
    if not user:
        return jsonify({'error': 'Kullanıcı bulunamadı'}), 404
    
    return jsonify({
        'name': user[0],
        'trust_score': float(user[1]) if user[1] else 0.5,
        'total_reports': user[2] or 0,
        'accurate_reports': user[3] or 0,
        'accuracy_rate': (user[3] / user[2] * 100) if user[2] and user[2] > 0 else 0
    })

# ==================== ADMIN ENDPOINTS ====================

@app.route('/api/admin/report-history', methods=['GET'])
def get_report_history():
    """Admin paneline onaylanan/reddedilen raporları getir - isteğe bağlı konteyner filtresiyle"""
    from flask import request
    
    status = request.args.get('status', 'approved')  # 'approved', 'rejected', 'all'
    container_id = request.args.get('container_id')  # Opsiyonel konteyner filtresi
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Onaylanan/reddedilen raporlar
    if status == 'approved':
        sql_condition = "WHERE cr.is_verified = 1"
    elif status == 'rejected':
        sql_condition = "WHERE cr.is_verified = -1"  # Reddedilen
    else:
        sql_condition = "WHERE cr.is_verified IN (1, -1)"  # Tümü
    
    # Konteyner filtresi ekle
    if container_id:
        sql_condition += f" AND cr.container_id = {int(container_id)}"
    
    cursor.execute(f"""
        SELECT 
            cr.user_id,
            cr.container_id,
            cr.fill_level as reported_fill_level,
            cr.timestamp as created_at,
            cr.notes,
            u.name as user_name,
            u.tc_number as user_tc,
            u.trust_score as user_trust_score,
            COALESCE(n.neighborhood_name, 'Bilgi Yok') as neighborhood,
            c.container_type,
            c.current_fill_level as system_fill_level,
            cr.id as id,
            cr.report_status,
            cr.photo_url
        FROM citizen_reports cr
        JOIN users u ON cr.user_id = u.user_id
        JOIN containers c ON cr.container_id = c.container_id
        LEFT JOIN neighborhoods n ON c.neighborhood_id = n.neighborhood_id
        {sql_condition}
        ORDER BY cr.timestamp DESC
    """)
    
    reports = []
    for row in cursor.fetchall():
        reports.append({
            'id': row['id'],
            'user_id': row['user_id'],
            'container_id': row['container_id'],
            'reported_fill_level': row['reported_fill_level'],
            'system_fill_level': row['system_fill_level'],
            'created_at': row['created_at'],
            'notes': row['notes'],
            'user_name': row['user_name'],
            'user_tc': row['user_tc'],
            'user_trust_score': row['user_trust_score'],
            'neighborhood': row['neighborhood'],
            'container_type': row['container_type'],
            'report_status': row['report_status'],
            'photo_url': row['photo_url'] if row['photo_url'] else None
        })
    
    conn.close()
    return jsonify({'reports': reports})

@app.route('/api/admin/pending-reports', methods=['GET'])
def get_pending_reports():
    """Admin paneline onay bekleyen raporları getir (sadece is_verified=0)"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Sadece onay bekleyen raporlar (is_verified = 0)
    cursor.execute("""
        SELECT 
            r.user_id,
            r.container_id,
            r.fill_level as reported_fill_level,
            r.timestamp as created_at,
            r.notes,
            u.name as user_name,
            u.tc_number as user_tc,
            u.trust_score as user_trust_score,
            COALESCE(n.neighborhood_name, 'Bilgi Yok') as neighborhood,
            c.container_type,
            c.current_fill_level as system_fill_level,
            r.id as id,
            r.report_status,
            r.photo_url
        FROM citizen_reports r
        JOIN users u ON r.user_id = u.user_id
        JOIN containers c ON r.container_id = c.container_id
        LEFT JOIN neighborhoods n ON c.neighborhood_id = n.neighborhood_id
        WHERE r.is_verified = 0
        ORDER BY r.timestamp DESC
    """)
    
    reports = []
    for row in cursor.fetchall():
        reports.append({
            'id': row['id'],
            'user_id': row['user_id'],
            'container_id': row['container_id'],
            'reported_fill_level': row['reported_fill_level'],
            'system_fill_level': row['system_fill_level'],
            'created_at': row['created_at'],
            'notes': row['notes'],
            'user_name': row['user_name'],
            'user_tc': row['user_tc'],
            'user_trust_score': row['user_trust_score'],
            'neighborhood': row['neighborhood'],
            'container_type': row['container_type'],
            'report_status': row['report_status'],
            'photo_url': row['photo_url'] if row['photo_url'] else None
        })
    
    conn.close()
    return jsonify({'reports': reports})

@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    """Admin paneli için tüm kullanıcıların listesini getir"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            user_id,
            name,
            tc_number,
            email,
            phone,
            trust_score,
            total_reports,
            accurate_reports,
            role
        FROM users
        ORDER BY trust_score DESC
    """)
    
    users = []
    for row in cursor.fetchall():
        users.append({
            'user_id': row['user_id'],
            'name': row['name'],
            'tc_number': row['tc_number'],
            'email': row['email'],
            'phone': row['phone'],
            'trust_score': row['trust_score'],
            'total_reports': row['total_reports'],
            'accurate_reports': row['accurate_reports'],
            'role': row['role']
        })
    
    conn.close()
    return jsonify({'users': users})

@app.route('/api/admin/logs', methods=['GET'])
def get_admin_logs():
    """Admin işlem kayıtlarını getir"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            log_id,
            action,
            report_id,
            target_user_id,
            target_container_id,
            old_value,
            new_value,
            timestamp
        FROM admin_logs
        ORDER BY timestamp DESC
        LIMIT 100
    """)
    
    logs = []
    for row in cursor.fetchall():
        logs.append({
            'log_id': row['log_id'],
            'action': row['action'],
            'report_id': row['report_id'],
            'target_user_id': row['target_user_id'],
            'target_container_id': row['target_container_id'],
            'old_value': row['old_value'],
            'new_value': row['new_value'],
            'timestamp': row['timestamp']
        })
    
    conn.close()
    return jsonify({'logs': logs})

@app.route('/api/admin/approve-report', methods=['POST'])
def approve_report():
    """Admin raporu onaylar: +0.25 güven puanı, konteyner güncelle"""
    from flask import request
    
    data = request.json
    report_id = data.get('report_id')
    user_id = data.get('user_id')
    container_id = data.get('container_id')
    new_fill_level = float(data.get('new_fill_level'))
    
    print(f"\n[DEBUG] approve_report called:")
    print(f"  report_id={report_id}, user_id={user_id}, container_id={container_id}, fill_level={new_fill_level}")
    
    # Eğer 0-100 arasında gelmişse, 0-1'e çevir
    if new_fill_level > 1.0:
        new_fill_level = new_fill_level / 100.0
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Raporu onayla (is_verified=1, report_status=1)
        cursor.execute("""
            UPDATE citizen_reports 
            SET is_verified = 1,
                report_status = 1
            WHERE id = ?
        """, (report_id,))
        r1 = cursor.rowcount
        print(f"  [UPDATE citizen_reports] Affected rows: {r1}")
        
        # Kullanıcıya +0.25 güven puanı ver
        cursor.execute("""
            UPDATE users 
            SET trust_score = trust_score + 0.25,
                accurate_reports = accurate_reports + 1
            WHERE user_id = ?
        """, (user_id,))
        r2 = cursor.rowcount
        print(f"  [UPDATE users] Affected rows: {r2}")
        
        # Konteyner doluluk seviyesini güncelle ve KİLİT
        cursor.execute("""
            UPDATE containers 
            SET current_fill_level = ?,
                fill_level_locked = 1,
                last_collection_date = ?
            WHERE container_id = ?
        """, (new_fill_level, datetime.now().isoformat(), container_id))
        r3 = cursor.rowcount
        print(f"  [UPDATE containers] Affected rows: {r3}")
        
        conn.commit()
        print(f"  [COMMIT] Success")
        
        # Güncellenmiş kullanıcı verilerini getir
        cursor.execute("SELECT trust_score FROM users WHERE user_id = ?", (user_id,))
        updated_trust = cursor.fetchone()[0]
        print(f"  [SELECT] New trust_score: {updated_trust}")
        
        conn.close()
        
        # Admin işlemini logs'a kaydet
        add_admin_log(
            action='APPROVE_REPORT',
            report_id=report_id,
            target_user_id=user_id,
            target_container_id=container_id,
            old_value=f"Report pending",
            new_value=f"Report approved, container fill: {new_fill_level:.2f}, user trust: +0.25"
        )
        
        # JSON ve CSV dosyalarını güncelle
        update_json_neighborhood_grouping()
        update_csv_address_based()
        
        return jsonify({
            'success': True,
            'message': 'Rapor onaylandı. Kullanıcı +0.25 puan kazandı.',
            'trust_added': 0.25,
            'new_trust_score': round(updated_trust, 2)
        })
    except Exception as e:
        print(f"  [ERROR] {str(e)}")
        conn.close()
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/admin/reject-report', methods=['POST'])
def reject_report():
    """Admin raporu reddeder: -0.25 güven puanı"""
    from flask import request
    
    data = request.json
    report_id = data.get('report_id')
    user_id = data.get('user_id')
    
    print(f"\n[DEBUG] reject_report called:")
    print(f"  report_id={report_id}, user_id={user_id}")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Raporu reddet (is_verified=-1, report_status=-1)
        cursor.execute("""
            UPDATE citizen_reports 
            SET is_verified = -1,
                report_status = -1
            WHERE id = ?
        """, (report_id,))
        r1 = cursor.rowcount
        print(f"  [UPDATE citizen_reports] Affected rows: {r1}")
        
        # Kullanıcıdan -0.25 güven puanı çek
        cursor.execute("""
            UPDATE users 
            SET trust_score = CASE 
                    WHEN trust_score - 0.25 < 0.0 THEN 0.0
                    ELSE trust_score - 0.25
                END
            WHERE user_id = ?
        """, (user_id,))
        r2 = cursor.rowcount
        print(f"  [UPDATE users] Affected rows: {r2}")
        
        conn.commit()
        print(f"  [COMMIT] Success")
        
        # Güncellenmiş kullanıcı verilerini getir
        cursor.execute("SELECT trust_score FROM users WHERE user_id = ?", (user_id,))
        updated_trust = cursor.fetchone()[0]
        print(f"  [SELECT] New trust_score: {updated_trust}")
        
        conn.close()
        
        # Admin işlemini logs'a kaydet
        add_admin_log(
            action='REJECT_REPORT',
            report_id=report_id,
            target_user_id=user_id,
            old_value=f"Report pending",
            new_value=f"Report rejected, user trust: -0.25"
        )
        
        # JSON ve CSV dosyalarını güncelle
        update_json_neighborhood_grouping()
        update_csv_address_based()
        
        return jsonify({
            'success': True,
            'message': 'Rapor reddedildi. Kullanıcı -0.25 puan kaybetti.',
            'trust_removed': 0.25,
            'new_trust_score': round(updated_trust, 2)
        })
    except Exception as e:
        print(f"  [ERROR] {str(e)}")
        conn.close()
        return jsonify({'success': False, 'error': str(e)})

# ============== CONTAINER MANAGEMENT ==============
@app.route('/api/admin/containers-list', methods=['GET'])
def get_containers_list():
    """Konteyner listesi (ilk 100)"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT container_id, container_type, capacity_liters, neighborhood_id
            FROM containers
            LIMIT 100
        """)
        
        rows = cursor.fetchall()
        conn.close()
        
        return jsonify({
            'total': len(rows),
            'containers': [
                {
                    'id': row['container_id'],
                    'type': row['container_type'],
                    'capacity': row['capacity_liters'],
                    'neighborhood_id': row['neighborhood_id']
                }
                for row in rows
            ]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/container/<int:container_id>', methods=['GET'])
def get_container_details(container_id):
    """Konteyner detaylarını getir"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                c.container_id,
                c.container_type,
                c.capacity_liters,
                c.current_fill_level,
                c.neighborhood_id,
                n.neighborhood_name,
                c.status
            FROM containers c
            LEFT JOIN neighborhoods n ON c.neighborhood_id = n.neighborhood_id
            WHERE c.container_id = ?
        """, (container_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return jsonify({'error': 'Konteyner bulunamadı'}), 404
        
        return jsonify({
            'container_id': row['container_id'],
            'container_type': row['container_type'] or 'Genel',
            'capacity_liters': row['capacity_liters'] or 770,
            'current_fill_level': row['current_fill_level'] or 0,
            'neighborhood_id': row['neighborhood_id'] or 1,
            'neighborhood_name': row['neighborhood_name'] or '',
            'status': row['status'] or 'active'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/neighborhoods', methods=['GET'])
def get_neighborhoods_list():
    """Tüm mahalleleri getir"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT neighborhood_id, neighborhood_name FROM neighborhoods ORDER BY neighborhood_name")
        rows = cursor.fetchall()
        conn.close()
        
        return jsonify({
            'neighborhoods': [{'id': row['neighborhood_id'], 'name': row['neighborhood_name']} for row in rows]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/update-container', methods=['POST'])
def update_container():
    """Konteyner bilgilerini güncelle"""
    try:
        data = request.get_json()
        container_id = data.get('container_id')
        container_type = data.get('container_type')
        capacity_liters = data.get('capacity_liters')
        neighborhood_id = data.get('neighborhood_id')
        status = data.get('status', 'active')
        
        if not all([container_id, container_type, capacity_liters, neighborhood_id]):
            return jsonify({'error': 'Gerekli alanlar eksik'}), 400
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Konteyner var mı kontrol et
        cursor.execute("SELECT container_id FROM containers WHERE container_id = ?", (container_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Konteyner bulunamadı'}), 404
        
        # Güncelle
        cursor.execute("""
            UPDATE containers 
            SET container_type = ?, capacity_liters = ?, neighborhood_id = ?, status = ?
            WHERE container_id = ?
        """, (container_type, capacity_liters, neighborhood_id, status, container_id))
        
        conn.commit()
        conn.close()
        
        # JSON ve CSV dosyalarını güncelle
        update_json_neighborhood_grouping()
        update_csv_address_based()
        
        return jsonify({
            'success': True,
            'message': f'Konteyner #{container_id} başarıyla güncellendi'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/add-container', methods=['POST'])
def add_container():
    """Yeni konteyner ekle"""
    try:
        data = request.get_json()
        container_type = data.get('container_type')
        capacity_liters = data.get('capacity_liters')
        neighborhood_id = data.get('neighborhood_id')
        location_lat = data.get('location_lat', 0.0)
        location_lon = data.get('location_lon', 0.0)
        
        if not all([container_type, capacity_liters, neighborhood_id]):
            return jsonify({'error': 'Gerekli alanlar eksik'}), 400
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # En son konteyner ID'sini bul
        cursor.execute("SELECT MAX(container_id) FROM containers")
        max_id = cursor.fetchone()[0] or 0
        new_id = max_id + 1
        
        # Yeni konteyner ekle - tüm gerekli alanlarla
        cursor.execute("""
            INSERT INTO containers 
            (container_id, container_type, capacity_liters, current_fill_level, 
             neighborhood_id, status, latitude, longitude, last_collection_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (new_id, container_type, capacity_liters, 0, neighborhood_id, 'active', 
              location_lat, location_lon, datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
        
        # JSON ve CSV dosyalarını güncelle
        update_json_neighborhood_grouping()
        update_csv_address_based()
        
        return jsonify({
            'success': True,
            'container_id': new_id,
            'message': f'Konteyner #{new_id} başarıyla oluşturuldu'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/delete-container/<int:container_id>', methods=['DELETE'])
def delete_container(container_id):
    """Konteyneri sil"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Konteyner var mı kontrol et
        cursor.execute("SELECT container_id FROM containers WHERE container_id = ?", (container_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Konteyner bulunamadı'}), 404
        
        # Sil
        cursor.execute("DELETE FROM containers WHERE container_id = ?", (container_id,))
        conn.commit()
        conn.close()
        
        # JSON ve CSV dosyalarını güncelle
        update_json_neighborhood_grouping()
        update_csv_address_based()
        
        return jsonify({
            'success': True,
            'message': f'Konteyner #{container_id} başarıyla silindi'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("=" * 60)
    print("NILUFER MUNICIPALITY - BACKEND API")
    print("=" * 60)
    print(f"\n[INFO] Model: {'Loaded [OK]' if model_data else 'NOT LOADED [ERROR]'}")
    print(f"[INFO] Database: {DB_PATH}")
    print("\n[INFO] API URLs:")
    print("  Citizen App: http://localhost:5000/")
    print("  Admin Panel: http://localhost:5000/admin")
    print("\n" + "=" * 60 + "\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)

