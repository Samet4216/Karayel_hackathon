"""
Complete Database Rebuild
Nilüfer Akıllı Atık Yönetim Sistemi
Loads: 66 neighborhoods + 2608 containers + users + test data
"""

import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import os
from difflib import SequenceMatcher
from werkzeug.security import generate_password_hash

DB_PATH = 'nilufer_waste.db'

print("=" * 80)
print("COMPLETE DATABASE REBUILD - NILÜFER WASTE MANAGEMENT")
print("=" * 80)

# Check if database exists - preserve existing data
db_exists = os.path.exists(DB_PATH)
if db_exists:
    print("\n✓ Database exists - preserving data")
else:
    print("\n✓ Creating new database")

# Create new database connection
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("\n📋 Creating tables...")

# Neighborhoods table
cursor.execute("""
    CREATE TABLE IF NOT EXISTS neighborhoods (
        neighborhood_id INTEGER PRIMARY KEY AUTOINCREMENT,
        neighborhood_name TEXT UNIQUE NOT NULL,
        population INTEGER DEFAULT 0,
        latitude REAL,
        longitude REAL
    )
""")

# Vehicle types
cursor.execute("""
    CREATE TABLE IF NOT EXISTS vehicle_types (
        type_id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_name TEXT UNIQUE NOT NULL,
        capacity_tons REAL,
        hourly_cost REAL
    )
""")

# Vehicles
cursor.execute("""
    CREATE TABLE IF NOT EXISTS vehicles (
        vehicle_id INTEGER PRIMARY KEY AUTOINCREMENT,
        plate_number TEXT UNIQUE NOT NULL,
        type_id INTEGER,
        status TEXT,
        FOREIGN KEY (type_id) REFERENCES vehicle_types(type_id)
    )
""")

# Containers
cursor.execute("""
    CREATE TABLE IF NOT EXISTS containers (
        container_id INTEGER PRIMARY KEY AUTOINCREMENT,
        neighborhood_id INTEGER,
        container_type TEXT,
        capacity_liters INTEGER,
        latitude REAL,
        longitude REAL,
        last_collection_date TEXT,
        current_fill_level REAL,
        status TEXT,
        FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods(neighborhood_id)
    )
""")

# Users
cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        tc_number TEXT UNIQUE,
        email TEXT UNIQUE,
        phone TEXT,
        password_hash TEXT,
        trust_score REAL DEFAULT 0.5,
        total_reports INTEGER DEFAULT 0,
        accurate_reports INTEGER DEFAULT 0,
        role TEXT DEFAULT 'citizen'
    )
""")

# Citizen reports
cursor.execute("""
    CREATE TABLE IF NOT EXISTS citizen_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        container_id INTEGER,
        fill_level REAL,
        notes TEXT,
        has_photo BOOLEAN,
        photo_url TEXT,
        timestamp TEXT,
        report_status INTEGER DEFAULT 0,
        is_verified INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (container_id) REFERENCES containers(container_id)
    )
""")

# Admin logs
cursor.execute("""
    CREATE TABLE IF NOT EXISTS admin_logs (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_user_id INTEGER,
        action TEXT,
        report_id INTEGER,
        target_user_id INTEGER,
        target_container_id INTEGER,
        old_value TEXT,
        new_value TEXT,
        timestamp TEXT,
        FOREIGN KEY (admin_user_id) REFERENCES users(user_id),
        FOREIGN KEY (report_id) REFERENCES citizen_reports(id),
        FOREIGN KEY (target_user_id) REFERENCES users(user_id),
        FOREIGN KEY (target_container_id) REFERENCES containers(container_id)
    )
""")

# Collection events
cursor.execute("""
    CREATE TABLE IF NOT EXISTS collection_events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        container_id INTEGER,
        vehicle_id INTEGER,
        collection_date TEXT,
        tonnage_collected REAL,
        fill_level_before REAL,
        collection_duration_minutes INTEGER,
        FOREIGN KEY (container_id) REFERENCES containers(container_id),
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
    )
""")

# Tonnage statistics
cursor.execute("""
    CREATE TABLE IF NOT EXISTS tonnage_statistics (
        stat_id INTEGER PRIMARY KEY AUTOINCREMENT,
        month TEXT UNIQUE,
        surface_tonnage REAL,
        underground_tonnage REAL,
        total_tonnage REAL
    )
""")

conn.commit()
print("✓ Tables created")

# ============== LOAD NEIGHBORHOODS ==============
print("\n📍 Loading neighborhoods...")

# Check if neighborhoods already exist
existing_neighborhoods = cursor.execute("SELECT COUNT(*) FROM neighborhoods").fetchone()[0]

if existing_neighborhoods == 0:
    # Load from container_counts.csv (has the master neighborhood list with containers)
    df_containers_master = pd.read_csv('data/container_counts.csv', encoding='utf-8-sig', sep=';')
    print(f"  Found {len(df_containers_master)} neighborhoods in container_counts.csv")

    # Load population data from mahalle_nufus.csv
    df_nufus = pd.read_csv('data/mahalle_nufus.csv', encoding='utf-8-sig', sep=';')
    nufus_map = {}
    for _, row in df_nufus.iterrows():
        name = str(row['mahalle']).strip().upper()
        nufus_map[name] = {
            'population': int(float(row['nufus']) * 1000),
            'latitude': float(row['latitude']),
            'longitude': float(row['longitude'])
        }

    # Load neighborhoods from container_counts.csv and match with mahalle_nufus
    def fuzzy_match(s1, s2):
        """Simple fuzzy match - return True if S1 base name is in S2"""
        s1 = s1.replace(' MAHALLESİ', '').replace(' MAH.', '').strip().upper()
        s2 = s2.strip().upper()
        return s1 == s2 or s2.startswith(s1)

    for _, row in df_containers_master.iterrows():
        mahalle_name = str(row['MAHALLE']).strip()
        mahalle_upper = mahalle_name.upper()
        
        # Try to match with population data
        population = 0
        latitude = 40.1857
        longitude = 28.8676
        
        # Direct match first
        if mahalle_upper in nufus_map:
            data = nufus_map[mahalle_upper]
            population = data['population']
            latitude = data['latitude']
            longitude = data['longitude']
        else:
            # Fuzzy match
            for nufus_name, data in nufus_map.items():
                if fuzzy_match(mahalle_upper, nufus_name):
                    population = data['population']
                    latitude = data['latitude']
                    longitude = data['longitude']
                    break
        
        cursor.execute("""
            INSERT INTO neighborhoods (neighborhood_name, population, latitude, longitude)
            VALUES (?, ?, ?, ?)
        """, (mahalle_name, population, latitude, longitude))

    conn.commit()
    neighborhood_count = cursor.execute("SELECT COUNT(*) FROM neighborhoods").fetchone()[0]
    total_pop = cursor.execute("SELECT SUM(population) FROM neighborhoods").fetchone()[0]
    print(f"  ✓ {neighborhood_count} neighborhoods loaded")
    print(f"  ✓ Total population: {total_pop:,}")
else:
    neighborhood_count = existing_neighborhoods
    print(f"✓ Neighborhoods already exist ({neighborhood_count} neighborhoods) - skipping")

# ============== LOAD VEHICLE TYPES ==============
print("\n🚛 Loading vehicle types...")

vehicle_types = [
    ('Küçük Çöp Kamyonu', 3.0, 500),
    ('Büyük Çöp Kamyonu', 8.0, 800),
    ('Vinçli Araç', 1.0, 400)
]

# Check if vehicle types already exist
existing_types = cursor.execute("SELECT COUNT(*) FROM vehicle_types").fetchone()[0]

if existing_types == 0:
    for name, capacity, cost in vehicle_types:
        cursor.execute("""
            INSERT INTO vehicle_types (type_name, capacity_tons, hourly_cost)
            VALUES (?, ?, ?)
        """, (name, capacity, cost))
    
    conn.commit()
    print("✓ Vehicle types loaded")
else:
    print("✓ Vehicle types already exist - skipping")

# ============== LOAD FLEET ==============
print("\n🚗 Loading fleet...")

# Check if vehicles already exist
existing_vehicles = cursor.execute("SELECT COUNT(*) FROM vehicles").fetchone()[0]

if existing_vehicles == 0:
    df_fleet = pd.read_csv('data/fleet.csv', encoding='utf-8-sig')

    type_map = {
        'Large Garbage Truck': 2,
        'Small Garbage Truck': 1,
        'Crane Vehicle': 3
    }

    for _, row in df_fleet.iterrows():
        vehicle_type = row['vehicle_type']
        type_id = type_map.get(vehicle_type, 2)
        plate = f"{row['vehicle_id']}-{row['vehicle_name']}"
        
        cursor.execute("""
            INSERT INTO vehicles (plate_number, type_id, status)
            VALUES (?, ?, 'active')
        """, (plate, type_id))

    conn.commit()
    vehicle_count = cursor.execute("SELECT COUNT(*) FROM vehicles").fetchone()[0]
    print(f"✓ {vehicle_count} vehicles loaded")
else:
    vehicle_count = existing_vehicles
    print(f"✓ Fleet already exists ({vehicle_count} vehicles) - skipping")
print(f"✓ {vehicle_count} vehicles loaded")

# ============== LOAD CONTAINERS ==============
print("\n🗑️  Loading containers from container_counts.csv...")

df_containers = pd.read_csv('data/container_counts.csv', encoding='utf-8-sig', sep=';')
print(f"  CSV has {len(df_containers)} rows")

# ============== LOAD CONTAINERS ==============
print("\n🗑️  Loading containers from container_counts.csv...")

# Check if containers already exist
existing_container_count = cursor.execute("SELECT COUNT(*) FROM containers").fetchone()[0]

if existing_container_count > 0:
    print(f"  ✓ Database already has {existing_container_count} containers - skipping load")
else:
    print(f"  Loading new containers...")
    
    # Re-read container_counts since we already loaded neighborhoods
    df_containers = pd.read_csv('data/container_counts.csv', encoding='utf-8-sig', sep=';')

    # Get neighborhood ID mapping
    cursor.execute("SELECT neighborhood_id, neighborhood_name FROM neighborhoods")
    neighborhood_map = {name.upper(): nid for nid, name in cursor.fetchall()}

    loaded_containers = 0
    unmatched_containers = 0

    for _, row in df_containers.iterrows():
        try:
            mahalle = str(row['MAHALLE']).strip().upper()
            
            # Find matching neighborhood
            neighborhood_id = neighborhood_map.get(mahalle)
            
            if not neighborhood_id:
                # Try fuzzy matching
                best_match = None
                best_ratio = 0
                for db_name, nid in neighborhood_map.items():
                    ratio = SequenceMatcher(None, mahalle, db_name).ratio()
                    if ratio > best_ratio:
                        best_ratio = ratio
                        best_match = nid
                
                if best_ratio > 0.80:
                    neighborhood_id = best_match
                else:
                    unmatched_containers += 1
                    continue
            
            # Get neighborhood center coordinates
            cursor.execute("SELECT latitude, longitude FROM neighborhoods WHERE neighborhood_id = ?", (neighborhood_id,))
            result = cursor.fetchone()
            if result:
                base_lat, base_lon = result
            else:
                base_lat, base_lon = 40.1857, 28.8676
            
            # Container types and counts
            container_types = [
                ('YERALTI', 1100, row.get('YERALTI KONTEYNER', 0)),
                ('770L', 770, row.get('770 LT KONTEYNER', 0)),
                ('400L', 400, row.get('400 LT KONTEYNER', 0)),
                ('PLASTİK', 60, row.get('PLASTİK', 0))
            ]
            
            last_collection = (datetime.now() - timedelta(days=random.randint(1, 10))).strftime('%Y-%m-%d')
            
            # Load each container type (1/10 of total)
            for container_type, capacity, count in container_types:
                if pd.isna(count) or count == '':
                    count = 0
                else:
                    count = int(count) // 10  # Reduce to 1/10
                
                for i in range(count):
                    # Scatter around neighborhood center
                    lat = base_lat + random.uniform(-0.003, 0.003)
                    lon = base_lon + random.uniform(-0.003, 0.003)
                    
                    # Random doluluk oranları - ilk sefer random, daha sonra kalıcı
                    fill_prob = random.random()
                    if fill_prob < 0.6:
                        fill_level = random.uniform(0.10, 0.35)
                    elif fill_prob < 0.9:
                        fill_level = random.uniform(0.35, 0.65)
                    else:
                        fill_level = random.uniform(0.65, 0.95)
                    
                    cursor.execute("""
                        INSERT INTO containers 
                        (neighborhood_id, container_type, capacity_liters, latitude, longitude, 
                         last_collection_date, current_fill_level, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (neighborhood_id, container_type, capacity, lat, lon, last_collection, fill_level, 'active'))
                    
                    loaded_containers += 1
        
        except Exception as e:
            print(f"  ⚠️  Error loading row: {e}")

    conn.commit()
    container_count = cursor.execute("SELECT COUNT(*) FROM containers").fetchone()[0]
    print(f"  ✓ {loaded_containers} containers loaded")
    if unmatched_containers > 0:
        print(f"  ⚠️  {unmatched_containers} neighborhoods couldn't be matched (skipped)")
    print(f"  ✓ Total in DB: {container_count} containers")

# ============== LOAD TEST USERS ==============
print("\n👥 Creating test users...")

# Check if test users already exist
existing_users = cursor.execute("SELECT COUNT(*) FROM users").fetchone()[0]

if existing_users == 0:
    test_users = [
        ('Ahmet Yılmaz', '12345678901', 'ahmet@example.com', '5301234567', 'sifre123', 0.85, 15),
        ('Fatma Demir', '23456789012', 'fatma@example.com', '5302234567', 'sifre123', 0.92, 18),
        ('Mehmet Kaya', '34567890123', 'mehmet@example.com', '5303234567', 'sifre123', 0.78, 12),
        ('Ayşe Şahin', '45678901234', 'ayse@example.com', '5304234567', 'sifre123', 0.88, 16),
        ('İbrahim Aslan', '56789012345', 'ibrahim@example.com', '5305234567', 'sifre123', 0.65, 8),
    ]

    for name, tc, email, phone, password, trust_score, total_reports in test_users:
        password_hash = generate_password_hash(password)
        cursor.execute("""
            INSERT INTO users (name, tc_number, email, phone, password_hash, trust_score, total_reports, accurate_reports, role)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (name, tc, email, phone, password_hash, trust_score, total_reports, int(total_reports * 0.85), 'citizen'))

    conn.commit()
    user_count = cursor.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    print(f"✓ {user_count} test users created")
else:
    user_count = existing_users
    print(f"✓ Test users already exist ({user_count} users) - skipping")

# ============== CREATE SAMPLE REPORTS ==============
print("\n📝 Creating sample reports...")

# NO SAMPLE REPORTS - Only user-submitted reports will be created
# cursor.execute("SELECT user_id FROM users")
# user_ids = [row[0] for row in cursor.fetchall()]
# cursor.execute("SELECT container_id FROM containers")
# container_ids = [row[0] for row in cursor.fetchall()]

# report_count = 0
# if container_ids:
#     for i in range(50):  # Create 50 sample reports
#         ...

print("✓ No sample reports created (will be submitted by users)")

# ============== FINAL STATISTICS ==============
print("\n" + "=" * 80)
print("✅ DATABASE REBUILD COMPLETE")
print("=" * 80)

stats = cursor.execute("""
    SELECT 
        (SELECT COUNT(*) FROM neighborhoods) as neighborhoods,
        (SELECT COUNT(*) FROM containers) as containers,
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM citizen_reports) as reports,
        (SELECT SUM(population) FROM neighborhoods) as total_population,
        (SELECT AVG(current_fill_level) FROM containers) as avg_fill_level
""").fetchone()

neighborhoods, containers, users, reports, total_pop, avg_fill = stats

print(f"""
📊 STATISTICS:
  • Neighborhoods: {neighborhoods}
  • Containers: {containers}
  • Users: {users}
  • Reports: {reports}
  • Total Population: {total_pop:,}
  • Average Fill Level: {avg_fill:.1%}

🏘️  TOP 5 NEIGHBORHOODS BY POPULATION:
""")

cursor.execute("""
    SELECT n.neighborhood_name, n.population, COUNT(c.container_id) as container_count
    FROM neighborhoods n
    LEFT JOIN containers c ON n.neighborhood_id = c.neighborhood_id
    GROUP BY n.neighborhood_id
    ORDER BY n.population DESC
    LIMIT 5
""")

for name, pop, count in cursor.fetchall():
    print(f"  • {name:<30} Nüfus: {pop:>10,} | Konteyner: {count:>4}")

conn.close()
print("\n✅ Ready to start server!")
