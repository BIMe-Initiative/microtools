import os
import json
import google.generativeai as genai
import json_repair
from pypdf import PdfReader
try: from docx import Document as DocxDocument
except: pass
import time

# --- CONFIG
API_KEY = "***REMOVED***"
SOURCE_FOLDER = "sources/library"
OUTPUT_FILE = "library_graph.json"
ONTOLOGY_FILE = "ontology_graph.json"

genai.configure(api_key=API_KEY)

def extract_text(filepath):
    text = ""
    try:
        if filepath.endswith('.pdf'):
            reader = PdfReader(filepath)
            for page in reader.pages: text += page.extract_text() + "\n"
        elif filepath.endswith('.docx'):
            doc = DocxDocument(filepath)
            for para in doc.paragraphs: text += para.text + "\n"
    except: pass
    return text

def build_library():
    print("📚 BUILDING SEMANTIC LIBRARY...")
    
    if not os.path.exists(ONTOLOGY_FILE):
        print("❌ Error: Run build_ontology.py first!")
        return
        
    with open(ONTOLOGY_FILE, 'r') as f:
        onto_data = json.load(f)
        
    # Create hint list of official codes
    existing_codes = [n['id'] for n in onto_data['nodes'] if len(str(n['id'])) < 10]
    codes_hint = ", ".join(existing_codes[:150]) 

    master_nodes = {}
    master_edges = []
    
    files = [f for f in os.listdir(SOURCE_FOLDER) if not f.startswith('.')]
    
    for filename in files:
        print(f"   Indexing {filename}...")
        text = extract_text(os.path.join(SOURCE_FOLDER, filename))
        if not text: continue
        
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        prompt = f"""
        Act as a BIMei Researcher. Analyze the document "{filename}".
        
        GOAL: Map the semantic relationships between this document and BIMei Concepts.
        
        1. IDENTIFY CONCEPTS:
           Look for standard BIMei Codes/Terms: {codes_hint}
           
        2. DETERMINE RELATIONSHIP TYPE (Choose the most specific):
           - "DEFINES": If this document is the *original source* or definition of the concept (e.g. 211in defines Model Uses).
           - "INCLUDES": If the document contains a list/table/module (e.g. Project A includes BIM Dictionary).
           - "EXTENDS": If the document updates or builds upon a previous concept.
           - "DISCUSSES": General mention or coverage of a topic.
        
        OUTPUT JSON:
        {{
          "nodes": [
            {{ "id": "{filename}", "label": "Short Title", "type": "Source", "desc": "Summary..." }}
          ],
          "edges": [
            {{ "source": "{filename}", "target": "ConceptCode", "label": "DEFINES" }}
          ]
        }}
        
        TEXT CHUNK: {text[:50000]}
        """
        
        try:
            resp = model.generate_content(prompt)
            data = json_repair.loads(resp.text.replace('```json', '').strip())
            
            for n in data.get('nodes', []):
                if n.get('type') == 'Source':
                    n['shape'] = 'square'
                    n['color'] = '#bfef45'
                    n['size'] = 25
                    master_nodes[n['id']] = n
            
            for e in data.get('edges', []):
                # Enforce uppercase labels for consistency
                e['label'] = e.get('label', 'DISCUSSES').upper()
                master_edges.append(e)
                
            time.sleep(2)
            
        except Exception as e: print(f"   Error: {e}")

    final = {"nodes": list(master_nodes.values()), "edges": master_edges}
    with open(OUTPUT_FILE, 'w') as f: json.dump(final, f, indent=2)
    print(f"✅ Library Built: {len(master_nodes)} sources linked.")

if __name__ == "__main__":
    build_library()