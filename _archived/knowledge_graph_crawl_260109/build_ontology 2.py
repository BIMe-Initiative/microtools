import os
import json
import google.generativeai as genai
import json_repair
from pypdf import PdfReader
import time

# --- CONFIG
API_KEY = os.getenv("GOOGLE_GENAI_API_KEY")
if not API_KEY:
    raise ValueError("GOOGLE_GENAI_API_KEY environment variable is required")

SOURCE_FOLDER = "sources/ontology_ref"
OUTPUT_FILE = "ontology_graph.json"
VISUALS_FILE = "ontology.json"

genai.configure(api_key=API_KEY)

def get_visuals():
    with open(VISUALS_FILE, 'r') as f: return json.load(f)['visuals']

def extract_text(path):
    text = ""
    try:
        reader = PdfReader(path)
        # FORCE READ ALL PAGES
        for i, page in enumerate(reader.pages):
            content = page.extract_text()
            if content: text += f"\n--- Page {i+1} ---\n{content}"
    except Exception as e: print(f"Error reading {path}: {e}")
    return text

def build_ontology():
    print("🏗️  BUILDING ONTOLOGY SKELETON...")
    visuals = get_visuals()
    master_nodes = {}
    master_edges = []
    
    files = [f for f in os.listdir(SOURCE_FOLDER) if f.endswith('.pdf')]
    
    for filename in files:
        print(f"   Processing {filename}...")
        text = extract_text(os.path.join(SOURCE_FOLDER, filename))
        
        # We process in larger chunks (up to 30k chars) to get context
        # But we do it carefully
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        prompt = f"""
        Act as a BIMei Data Architect. Extract structured concepts from this text.
        
        RULES:
        1. Extract specific Codes: Projects (A, B), Microprojects (A1, B2), Topics (TP01), Model Uses (4040), Competencies (M01).
        2. Assign Types: "Project", "Topic", "ModelUse", "Competency", "Publication" (e.g. 201in).
        3. Extract Relationships: Which concept belongs to which?
        
        OUTPUT JSON:
        {{
          "nodes": [
            {{ "id": "Code if exists (e.g. TP01), else Name", "label": "Name", "type": "Topic", "desc": "Def..." }}
          ],
          "edges": [
            {{ "source": "ParentID", "target": "ChildID", "label": "includes" }}
          ]
        }}
        
        TEXT: {text[:80000]}
        """
        
        try:
            resp = model.generate_content(prompt)
            data = json_repair.loads(resp.text.replace('```json', '').strip())
            
            for n in data.get('nodes', []):
                nid = n.get('id')
                if nid and nid not in master_nodes:
                    # Apply Visuals based on Type
                    style = visuals.get(n.get('type'), visuals['Hierarchy']) # Default to triangle
                    n.update({'color': style['color'], 'shape': style['shape'], 'size': style['size']})
                    master_nodes[nid] = n
            
            for e in data.get('edges', []):
                master_edges.append(e)
                
            time.sleep(2) # Avoid Rate Limits
            
        except Exception as e: print(f"   Failed to process {filename}: {e}")

    # Save
    final = {"nodes": list(master_nodes.values()), "edges": master_edges}
    with open(OUTPUT_FILE, 'w') as f: json.dump(final, f, indent=2)
    print(f"✅ Ontology Built: {len(master_nodes)} nodes saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    build_ontology()