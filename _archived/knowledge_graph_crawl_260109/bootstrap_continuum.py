import os
import json
import google.generativeai as genai
import json_repair
from pypdf import PdfReader
try: from docx import Document as DocxDocument
except: pass
import time

# --- CONFIGURATION ---
API_KEY = os.getenv("GOOGLE_GENAI_API_KEY")
if not API_KEY:
    raise ValueError("GOOGLE_GENAI_API_KEY environment variable is required")

SOURCE_FOLDER = "sources/library"
OUTPUT_FILE = "sources/ontology_ref/research_continuum.json"

genai.configure(api_key=API_KEY)

def extract_text(filepath):
    text = ""
    try:
        if filepath.endswith('.pdf'):
            reader = PdfReader(filepath)
            # Read first 10 pages (Abstract + Intro + Methodology usually contain the definitions)
            for i, page in enumerate(reader.pages[:10]): 
                text += page.extract_text() + "\n"
        elif filepath.endswith('.docx'):
            doc = DocxDocument(filepath)
            for para in doc.paragraphs: text += para.text + "\n"
    except: pass
    return text

def analyze_paper_dna(filename, text):
    model = genai.GenerativeModel('gemini-2.0-flash')
    
    prompt = f"""
    Act as a BIMei Ontologist. Analyze the academic paper "{filename}".
    
    GOAL: Extract the "Intellectual DNA" (Constructs) defined in this paper.
    
    1. IDENTIFY THE PAPER CODE:
       Look for codes like "Paper A2", "A2", "B4", "201in". If unsure, use the filename.
       
    2. EXTRACT DEFINED CONSTRUCTS (Look for these specific codes/types):
       - Frameworks (FR + number, e.g. FR1)
       - Models (MD + number, e.g. MD2)
       - Taxonomies (TX + number, e.g. TX1)
       - Classifications (CL + number, e.g. CL2)
       - Tools (TL + number, e.g. TL2)
       - Terminology (TR + number)
       
    3. MAP RELATIONSHIPS:
       - [Paper ID] -> DEFINES -> [Construct ID]
       - [Construct ID] -> INCLUDES/COMPOSED_OF -> [Sub-Construct ID] (e.g. Model MD2 is composed of Classification CL1)
       
    OUTPUT JSON:
    {{
      "nodes": [
        {{ "id": "A2", "label": "Paper A2: Title...", "type": "Publication", "desc": "Citation..." }},
        {{ "id": "FR1", "label": "Tri-Axial Framework", "type": "Framework", "desc": "Definition..." }}
      ],
      "edges": [
        {{ "source": "A2", "target": "FR1", "label": "DEFINES" }}
      ]
    }}
    
    TEXT SAMPLE: {text[:60000]}
    """
    
    try:
        print(f"   🧬 Extracting DNA from {filename}...")
        resp = model.generate_content(prompt)
        return json_repair.loads(resp.text.replace('```json', '').strip())
    except Exception as e:
        print(f"   ⚠️ Error: {e}")
        return {"nodes": [], "edges": []}

def run_bootstrap():
    print("🚀 STARTING BOOTSTRAP: Generating Research Continuum...")
    
    # Ensure output folder exists
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    master_nodes = {}
    master_edges = []
    
    files = [f for f in os.listdir(SOURCE_FOLDER) if f.lower().endswith(('.pdf', '.docx'))]
    
    for filename in files:
        text = extract_text(os.path.join(SOURCE_FOLDER, filename))
        if not text: continue
        
        data = analyze_paper_dna(filename, text)
        
        # Merge Nodes
        for n in data.get('nodes', []):
            if n.get('id'):
                # Enforce clean types
                valid_types = ["Publication", "Framework", "Model", "Taxonomy", "Classification", "Tool", "Terminology"]
                if n.get('type') not in valid_types: n['type'] = "Model" # Fallback
                master_nodes[n['id']] = n
                
        # Merge Edges
        for e in data.get('edges', []):
            master_edges.append(e)
            
        time.sleep(2) # Be nice to the API

    # Save to the specific location where build_ontology.py looks for it
    final = {"nodes": list(master_nodes.values()), "edges": master_edges}
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(final, f, indent=2)
        
    print(f"✅ BOOTSTRAP COMPLETE. Saved {len(master_nodes)} constructs to {OUTPUT_FILE}")
    print("   -> Now run 'build_ontology.py' to bake this into the graph.")

if __name__ == "__main__":
    run_bootstrap()