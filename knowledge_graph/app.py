import streamlit as st
import google.generativeai as genai

st.title("🛠️ Connection Diagnostics")

# 1. Check if Key exists
try:
    key = st.secrets["GOOGLE_API_KEY"]
    st.write(f"✅ Key found (Starts with: {key[:5]}...)")
except:
    st.error("❌ Key NOT found in secrets.")
    st.stop()

# 2. Test the Connection
if st.button("Test Connection Now"):
    try:
        genai.configure(api_key=key)
        # We use 'gemini-1.5-flash' because it is the standard now.
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        st.info("Attempting to contact Google...")
        response = model.generate_content("Reply with the word 'Success'")
        
        st.success(f"🎉 IT WORKED! Google said: {response.text}")
        
    except Exception as e:
        st.error("❌ CONNECTION FAILED")
        st.write("Here is the exact error:")
        st.code(e) # This will print the full error message clearly
