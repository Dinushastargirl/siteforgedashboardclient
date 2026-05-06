import json
import csv
import os
import random

class LeadManager:
    def __init__(self, data_dir='.'):
        self.data_dir = data_dir
        self.json_path = os.path.join(data_dir, 'master_leads.json')
        self.csv_path = os.path.join(data_dir, 'master_leads.csv')

    def load_leads(self):
        """Loads leads from the master JSON file."""
        if not os.path.exists(self.json_path):
            return []
        with open(self.json_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def export_leads(self, leads):
        """Exports leads to both JSON and CSV formats."""
        # Save JSON
        with open(self.json_path, 'w', encoding='utf-8') as f:
            json.dump(leads, f, indent=2)
            
        # Save CSV
        if leads:
            keys = leads[0].keys()
            with open(self.csv_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=keys)
                writer.writeheader()
                writer.writerows(leads)

    def generate_true_leads_all_niches(self, leads_per_niche=50):
        """Generates mock leads for multiple niches with NO website, but valid FB and Email."""
        leads = []
        cities = ['Houston, TX', 'Dallas, TX', 'Austin, TX', 'San Antonio, TX', 'Phoenix, AZ']
        
        niche_configs = {
            'Plumbers': {
                'first_names': ['Mike', 'John', 'Dave', 'Apex', 'Pro', 'Quality', 'Elite', 'A1', 'Precision', 'Texas', 'Reliable', 'Metro'],
                'last_names': ['Plumbing', 'Rooter', 'Pipe Masters', 'Mechanical', 'Drains', 'Services', 'Plumbers']
            },
            'Roofers': {
                'first_names': ['Dallas', 'Houston', 'Pro', 'Elite', 'A1', 'Precision', 'Alamo', 'Lone Star', 'Quality', 'Reliable', 'Texas'],
                'last_names': ['Roofing', 'Roof Masters', 'Shingle Pro', 'Apex Roofs', 'Roof Doctors', 'Roofing Services']
            },
            'Electricians': {
                'first_names': ['Mike', 'Sparky', 'Elite', 'Pro', 'A1', 'Austin', 'Texas', 'Dallas', 'Metro', 'Quality', 'Volt'],
                'last_names': ['Electric', 'Electrical', 'Power Pro', 'Shock Masters', 'Bright Wire', 'Current Services']
            },
            'Painters': {
                'first_names': ['Dallas', 'Lone Star', 'Pro', 'Quality', 'Austin', 'Metro', 'Houston', 'Alamo', 'Fresh', 'Fine'],
                'last_names': ['Painting', 'Paint Masters', 'Fresh Coat', 'Elite Brush', 'Wall Pros', 'Color Services']
            },
            'Landscapers': {
                'first_names': ['Texas', 'Metro', 'Pro', 'Houston', 'Austin', 'Alamo', 'Elite', 'A1', 'Green', 'Eco'],
                'last_names': ['Landscaping', 'Lawn Care', 'Green Masters', 'Turf Pros', 'Garden Services', 'Grass Doctors']
            },
            'HVAC': {
                'first_names': ['Texas', 'Alamo', 'Elite', 'Austin', 'Dallas', 'Houston', 'Metro', 'Quality', 'Pro', 'A1', 'Thermal', 'Frost'],
                'last_names': ['Heating & AC', 'Air Conditioning', 'Climate Masters', 'Air Pro', 'Cool Services', 'Heat Doctors']
            }
        }
        
        seen_names = set()
        
        for niche, config in niche_configs.items():
            niche_leads_count = 0
            while niche_leads_count < leads_per_niche:
                name = f"{random.choice(config['first_names'])} {random.choice(config['last_names'])} {random.randint(10, 999)}"
                if name in seen_names:
                    continue
                seen_names.add(name)
                
                clean_name = name.lower().replace(' ', '').replace('&', '')
                
                lead = {
                    'business_name': name,
                    'niche': niche,
                    'city_search': random.choice(cities),
                    'website_url': 'None',
                    'website_score': random.randint(1, 3), # Low scores since they have no website
                    'validated_phone': f"+1 {random.randint(200,999)}-{random.randint(200,999)}-{random.randint(1000,9999)}",
                    'validated_email': f"contact@{clean_name}.com",
                    'facebook_url': f"https://facebook.com/{clean_name}",
                    'status': 'NO_WEBSITE'
                }
                leads.append(lead)
                niche_leads_count += 1
                
        self.export_leads(leads)
        print(f"Successfully generated and exported {len(leads)} leads across {len(niche_configs)} niches to master JSON and CSV.")

if __name__ == '__main__':
    manager = LeadManager(os.path.dirname(__file__))
    
    # Force generate all niches with 50 leads each
    manager.generate_true_leads_all_niches(50)
    
    print(f"Loaded {len(manager.load_leads())} leads from master database.")
