# Get API key: https://cloud.google.com/maps-platform
# Free tier: 25,000 requests/month

from google.maps import places

client = places.Client(key='YOUR_KEY')

cities = [
    (29.7604, -95.3698, 'Houston'),
    (33.4484, -112.0740, 'Phoenix'),
    (30.2672, -97.7431, 'Austin'),
    (39.7392, -104.9903, 'Denver'),
    (32.7157, -117.1611, 'San Diego')
]

all_leads = []
for lat, lng, city in cities:
    results = client.places_nearby(
        location={'lat': lat, 'lng': lng},
        radius=25000,
        keyword='plumber',
        type='plumber'
    )
    all_leads.extend(results)

# Save to CSV
import csv
with open('raw_plumber_leads.csv', 'w') as f:
    writer = csv.DictWriter(f, fieldnames=['name', 'address', 'phone', 'website'])
    writer.writeheader()
    for lead in all_leads:
        writer.writerow({
            'name': lead.get('name'),
            'address': lead.get('formatted_address'),
            'phone': lead.get('formatted_phone_number'),
            'website': lead.get('website')
        })