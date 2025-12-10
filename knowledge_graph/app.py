import streamlit as st
import google.generativeai as genai
import sys

st.title("🕵️ Model Finder")

# 1. Check Library Version
st.write(f"**Python Version:** {sys.version.split()[0]}")
try:
    st.write(f"**Google Library Version:** {genai.__version__}")
except:
    st.write("**Google Library Version:** Unknown (Old)")

# 2. Check Key
try:
    key = st.secrets["GOOGLE_API_KEY"]
    genai.configure(api_key=key)
    st.success("✅ Key Configured")
except Exception as e:
    st.error(f"❌ Key Error: {e}")
    st.stop()

# 3. List Available Models
if st.button("List Available Models"):
    try:
        st.info("Asking Google what models are available...")
        
        # Get list of models
        models_iter = genai.list_models()
        
        found_any = False
        st.write("---")
        st.subheader("Available Models:")
        
        for m in models_iter:
            # We only care about models that can generate text
            if 'generateContent' in m.supported_generation_methods:
                st.code(m.name) # This prints the exact ID we need
                found_any = True
                
        if not found_any:
            st.warning("No text-generation models found. Check API Key permissions.")
            
    except Exception as e:
        st.error("❌ Listing Failed")
        st.code(e)
