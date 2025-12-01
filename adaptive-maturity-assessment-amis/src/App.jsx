import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { ChevronRight, RotateCcw, HelpCircle, Download, User, ExternalLink } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import ReCAPTCHA from "react-google-recaptcha";

// --- CONSTANTS ---
const VERSION_INFO = "Adaptive Maturity Measurement Microtool v1.0 (1 Dec 2025)";
const EPISODE_TITLE_PREFIX = "BIM THINKSPACE EPISODE 28:";
const EPISODE_TITLE_MAIN = "Measuring and Improving Adaptive Maturity";
const POST_URL = "https://BIMexcellence.org/measuring-adaptive-maturity";
const BRAND_COLOR = "#f37f73"; 
const RECAPTCHA_SITE_KEY = "6LeAJR0sAAAAAG2bBy6MqmJbzmpa6_KjplWXrfXz";

// --- ASSETS ---

const LINK_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
</svg>`;
const LINK_ICON_URI = `data:image/svg+xml;base64,${btoa(LINK_ICON_SVG)}`;

const CC_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" viewBox="0 0 304 73">
  <g fill="#64748b">
    <path d="M200.315 0V6.491H191.877V0H200.315ZM191.876 38.512V9.736H200.314V38.512H191.876ZM183.668 10.277H188.699H188.7V15.47H183.669V29.586C183.669 31.858 184.804 32.453 186.32 32.453C187.239 32.453 188.428 32.345 188.862 32.291V38.944C187.78 39.053 185.292 39.269 183.453 39.269C176.258 39.269 175.23 34.78 175.23 30.615V15.469H171.12V10.277H175.23V1.94699H183.668V10.277ZM81.354 8.979C86.817 8.979 91.523 10.981 94.282 16.011L87.79 19.419C86.276 16.173 83.679 15.47 82.381 15.47C77.567 15.47 75.836 19.202 75.836 24.124C75.836 29.047 77.891 32.779 82.381 32.779C84.977 32.779 87.032 31.806 88.385 28.56L94.443 31.643C91.847 36.241 87.141 39.27 81.624 39.27C73.024 39.27 67.074 33.806 67.074 24.124C67.074 14.604 73.403 8.979 81.354 8.979ZM81.354 42.084C86.817 42.084 91.523 44.086 94.282 49.116L87.79 52.525C86.276 49.279 83.679 48.576 82.381 48.576C77.567 48.576 75.836 52.308 75.836 57.231C75.836 62.153 77.891 65.885 82.381 65.885C84.977 65.885 87.032 64.911 88.385 61.665L94.443 64.748C91.847 69.346 87.141 72.375 81.624 72.375C73.024 72.375 67.074 66.912 67.074 57.23C67.074 47.709 73.403 42.084 81.354 42.084ZM109.746 42.084C100.767 42.084 94.439 47.547 94.439 57.23C94.439 66.912 100.767 72.375 109.746 72.375C118.725 72.375 125.054 66.912 125.054 57.23C125.054 47.548 118.725 42.084 109.746 42.084ZM109.746 48.575C114.56 48.575 116.616 52.307 116.616 56.905C116.616 62.152 114.56 65.884 109.746 65.884C104.932 65.884 102.877 62.152 102.877 57.23C102.877 52.308 104.932 48.575 109.746 48.575ZM126.783 71.617H135.221V53.714C135.221 51.118 136.303 48.9 139.71 48.9C142.956 48.9 143.821 50.793 143.821 53.606V71.618H152.259V53.93C152.259 51.009 153.719 48.9 156.532 48.9C159.723 48.9 160.859 50.739 160.859 54.796V71.617H169.297V49.657C169.297 43.058 163.239 42.084 160.426 42.084C157.072 42.084 153.935 43.112 151.177 45.924C149.283 43.382 146.85 42.084 143.55 42.084C140.954 42.084 137.384 42.841 135.22 45.384V42.842H126.782V71.617H126.783ZM180.435 71.617H171.997H171.996V42.842H180.434V45.384C182.598 42.841 186.168 42.084 188.764 42.084C192.064 42.084 194.498 43.382 196.391 45.924C199.15 43.112 202.286 42.084 205.64 42.084C208.452 42.084 214.511 43.058 214.511 49.657V71.617H206.073V54.796C206.073 50.739 204.936 48.9 201.745 48.9C198.933 48.9 197.473 51.009 197.473 53.93V71.618H189.035V53.606C189.035 50.793 188.17 48.9 184.924 48.9C181.517 48.9 180.435 51.118 180.435 53.714V71.617ZM216.236 57.23C216.236 47.547 222.565 42.084 231.544 42.084C240.523 42.084 246.852 47.548 246.852 57.23C246.852 66.912 240.523 72.375 231.544 72.375C222.564 72.375 216.236 66.912 216.236 57.23ZM238.413 56.905C238.413 52.307 236.357 48.575 231.544 48.575C226.73 48.575 224.674 52.308 224.674 57.23C224.674 62.152 226.73 65.884 231.544 65.884C236.357 65.884 238.413 62.152 238.413 56.905ZM257.56 71.617H249.122H249.121V42.842H257.559V45.384C259.723 42.841 263.293 42.084 265.889 42.084C272.704 42.084 274.598 46.033 274.598 50.36V71.618H266.16V53.606C266.16 50.793 265.295 48.9 262.05 48.9C258.642 48.9 257.56 51.118 257.56 53.714V71.617ZM302.774 46.25C298.879 43.654 294.499 42.085 290.063 42.085C284.22 42.085 277.892 44.898 277.892 52.146C277.892 58.2943 284.055 59.4536 288.967 60.3778C292.223 60.9902 294.93 61.4994 294.93 63.289C294.93 65.886 291.74 66.21 290.332 66.21C286.492 66.21 283.842 64.642 281.245 62.153L275.998 66.696C280.218 70.591 283.787 72.376 290.062 72.376C296.335 72.376 303.043 69.671 303.043 62.099C303.043 55.6774 296.979 54.5307 292.086 53.6055C288.778 52.9799 286.005 52.4556 286.005 50.47C286.005 49.01 287.519 48.253 289.628 48.253C292.279 48.253 295.903 49.335 297.579 51.336L302.774 46.25ZM96.34 38.512H104.778V21.852C104.778 18.661 106.779 17.795 111.81 17.2L112.729 17.092L112.675 9.62799C109.7 9.84499 106.617 10.926 104.778 12.657V9.73599H96.34V38.512ZM141.386 25.855C141.332 16.984 137.762 8.979 127.268 8.979C118.505 8.979 113.15 14.821 113.15 24.99C113.15 33.103 118.343 39.27 127.268 39.27C133.705 39.27 138.302 36.728 141.223 31.319L134.894 28.019C132.46 31.481 130.999 33.103 127.862 33.103C125.158 33.103 121.642 31.372 121.588 25.855H141.386ZM121.481 20.663C121.859 16.876 124.78 15.146 127.214 15.146C129.648 15.146 132.677 16.444 132.947 20.663H121.481ZM156.036 8.979C163.879 8.979 168.801 10.818 168.855 17.309V32.509C168.855 34.511 168.909 36.728 169.612 38.513H161.823C161.499 37.539 161.336 36.512 161.282 35.538H161.174C159.768 37.81 155.549 39.27 152.52 39.27C147.003 39.27 142.892 36.241 142.892 30.724C142.892 23.8 148.464 21.366 157.659 20.068L160.742 19.635V17.255C160.742 15.091 159.011 14.172 156.739 14.172C154.034 14.172 152.737 15.145 152.304 18.012H144.19C144.461 9.736 152.141 8.979 156.036 8.979ZM154.954 33.103C158.254 33.103 160.742 30.885 160.742 26.504V24.503L155.062 26.126C152.952 26.721 151.005 27.532 151.005 29.858C151.005 32.129 152.898 33.103 154.954 33.103ZM220.162 38.512H211.67L201.934 9.73599H210.966L215.944 30.074H216.051L221.028 9.73599H230.007L220.162 38.512ZM243.139 8.979C253.632 8.979 257.202 16.984 257.256 25.855H237.46C237.513 31.372 241.03 33.103 243.734 33.103C246.87 33.103 248.331 31.481 250.765 28.019L257.094 31.319C254.173 36.728 249.576 39.27 243.139 39.27C234.213 39.27 229.022 33.103 229.022 24.99C229.022 14.821 234.375 8.979 243.139 8.979ZM243.084 15.146C240.65 15.146 237.73 16.876 237.351 20.663H248.818C248.548 16.444 245.518 15.146 243.084 15.146ZM31.602 8.495C22.92 8.495 15.28 11.708 9.376 17.698C3.299 23.863 0 31.85 0 40.185C0 48.606 3.212 56.42 9.29 62.498C15.367 68.575 23.268 71.874 31.602 71.874C39.936 71.874 48.011 68.575 54.262 62.411C60.166 56.594 63.291 48.867 63.291 40.185C63.291 31.59 60.166 23.776 54.175 17.785C48.098 11.708 40.284 8.495 31.602 8.495ZM31.689 14.226C38.808 14.226 45.146 16.917 50.095 21.866C54.956 26.728 57.561 33.153 57.561 40.185C57.561 47.304 55.043 53.555 50.181 58.331C45.058 63.366 38.46 66.058 31.688 66.058C24.829 66.058 18.404 63.367 13.456 58.418C8.507 53.468 5.729 46.957 5.729 40.185C5.729 33.326 8.507 26.815 13.456 21.779C18.318 16.831 24.57 14.226 31.689 14.226ZM31.28 34.919C29.49 31.655 26.436 30.356 22.891 30.356C17.731 30.356 13.624 34.006 13.624 40.185C13.624 46.468 17.485 50.014 23.067 50.014C26.648 50.014 29.701 48.048 31.386 45.065L27.454 43.064C26.576 45.17 25.243 45.802 23.558 45.802C20.644 45.802 19.311 43.38 19.311 40.186C19.311 36.992 20.434 34.569 23.558 34.569C24.4 34.569 26.085 35.026 27.068 37.131L31.28 34.919ZM41.173 30.356C44.718 30.356 47.771 31.655 49.562 34.919L45.35 37.131C44.366 35.026 42.681 34.569 41.839 34.569C38.715 34.569 37.591 36.992 37.591 40.186C37.591 43.38 38.926 45.802 41.839 45.802C43.524 45.802 44.858 45.17 45.735 43.064L49.667 45.065C47.982 48.048 44.929 50.014 41.348 50.014C35.767 50.014 31.905 46.468 31.905 40.185C31.905 34.006 36.013 30.356 41.173 30.356Z"/>
  </g>
</svg>`;
const CC_LOGO_DATA_URI = `data:image/svg+xml;base64,${btoa(CC_LOGO_SVG)}`;

const HEADER_LOGO_SVG_RAW = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 200">
  <g>
    <text transform="translate(335.54 85.6)" fill="#f37f72" font-family="Arial, sans-serif" font-weight="bold" font-size="100"><tspan x="0" y="0">EXCELLENCE</tspan></text>
    <text transform="translate(335.69 174.83)" fill="#f37f72" font-family="Arial, sans-serif" font-weight="bold" font-size="100"><tspan x="0" y="0">INITIATIVE</tspan></text>
  </g>
  <g>
    <path d="M312.55,15.83l-66.19,38.18L180.18,15.83v160h6.24c6.64,0,11.89-6.07,11.89-12.71V47.07l48.05,27.77,48.05-27.77v128.76h6.22c6.64,0,11.91-6.07,11.91-12.71V15.83Z" fill="#4e4e4e"/>
    <path d="M146.03,175.14h-6.2V27.85c0-6.64,5.38-12.02,12.02-12.02h6.13v147.27c.1,6.65-5.29,12.05-11.95,12.05Z" fill="#4e4e4e"/>
    <path d="M85.94,86.72c9.97-7.39,13.31-18.7,13.31-31.3,0-21.55-18.04-39.59-40.58-39.59-2.51,0-14.6.05-24.1.08-6.62.03-11.97,5.4-11.97,12.02v147.2h49.85c24.75,0,44.89-20.56,44.89-45.42,0-19.69-12.92-37.19-31.39-43ZM81.21,56.41c0,22.24-17.68,31.07-21.04,33.01-3.36,1.94-8.62,4.96-8.62,4.96-5,2.54-10.92-1.09-10.92-6.7v-53.81h19.54c14.53,0,21.04,10.43,21.04,22.54ZM72.87,157.11h-32.23v-36.07c0-2.68,1.43-5.17,3.76-6.51l15.78-9.11c27.06-14.61,39.08,3.88,39.08,19.23,0,17.67-11.57,32.46-26.38,32.46Z" fill="#4e4e4e"/>
  </g>
</svg>`;
const HEADER_LOGO_DATA_URI = `data:image/svg+xml;base64,${btoa(HEADER_LOGO_SVG_RAW)}`;

// --- DATA SOURCE ---
const INDICATORS = [
  // PMI Specific
  { id: 'ami1', code: 'AMI-1', title: 'Clarity of processes', axis: 'PMI', desc: 'Degree to which important activities are defined, documented, and consistently followed.' },
  { id: 'ami11', code: 'AMI-11', title: 'Preparedness for change', axis: 'PMI', desc: 'Extent to which the organisation plans and invests in readiness for disruption.' },
  
  // ACI Specific
  { id: 'ami2', code: 'AMI-2', title: 'Signal-to-action speed', axis: 'ACI', desc: 'Speed of action (detect + decide + act) when disruption is detected.' },
  { id: 'ami3', code: 'AMI-3', title: 'Ability to sustain improvements', axis: 'ACI', desc: 'Are adaptive responses sustained and diffused, or abandoned quickly?' },
  { id: 'ami4', code: 'AMI-4', title: 'Energy for change', axis: 'ACI', desc: 'Level of enthusiasm and proactive effort shown during disruptive change.' },
  { id: 'ami5', code: 'AMI-5', title: 'Speed of recovery', axis: 'ACI', desc: 'Time taken to return to performance standards after a negative disruption.' },
  { id: 'ami7', code: 'AMI-7', title: 'Openness to ideas', axis: 'ACI', desc: 'Willingness of leaders and teams to try new approaches.' },
  { id: 'ami8', code: 'AMI-8', title: 'Shared purpose', axis: 'ACI', desc: 'Clarity of staff understanding regarding goals and values under pressure.' },
  { id: 'ami9', code: 'AMI-9', title: 'Balanced risk-taking', axis: 'ACI', desc: 'How well risks are managed without stalling improvement initiatives.' },
  { id: 'ami12', code: 'AMI-12', title: 'Flexibility of resources', axis: 'ACI', desc: 'Ease of reallocating staff, equipment, and budgets during crisis.' },
  { id: 'ami13', code: 'AMI-13', title: 'Clarity of communication', axis: 'ACI', desc: 'Timeliness and quality of information shared during disruption.' },

  // Shared (Composite)
  { id: 'ami6', code: 'AMI-6', title: 'Learning from experience', axis: 'BOTH', desc: 'Are lessons from successes or mistakes captured and applied?' },
  { id: 'ami10', code: 'AMI-10', title: 'Coordination across teams', axis: 'BOTH', desc: 'Effectiveness of collaboration across boundaries during change.' },
];

const STATE_DATA = {
  '1-1': { title: 'Stagnant', desc: 'No maturity or adaptability; organisation operates reactively without consistency' },
  '1-2': { title: 'Stagnant', desc: 'Low maturity and adaptability; performance may occasionally but temporarily improve' },
  '1-3': { title: 'Stagnant/Chaotic Overlap', desc: 'Some adaptability exists, but lack of structure causes inconsistent results' },
  '1-4': { title: 'Chaotic', desc: 'Adaptable but completely unstructured; success depends on individual initiative' },
  '1-5': { title: 'Chaotic', desc: 'Highly adaptable yet process-free; vulnerable to inconsistency and rework' },
  '2-1': { title: 'Stagnant', desc: 'Minimal structure and no adaptability; rigid habits despite poor process quality' },
  '2-2': { title: 'Stagnant', desc: 'Low structure and low adaptability; basic operations are inconsistent' },
  '2-3': { title: 'Stagnant/Chaotic Overlap', desc: 'Adaptability occasionally appears but is undermined by weak processes' },
  '2-4': { title: 'Chaotic', desc: 'Strong adaptability in some areas but no consistent frameworks' },
  '2-5': { title: 'Chaotic', desc: 'Very high adaptability, no structure; resilience comes from people not systems' },
  '3-1': { title: 'Stagnant/Rigid Overlap', desc: 'Processes starting to emerge but adaptability absent; prone to over-reliance on routine' },
  '3-2': { title: 'Stagnant/Rigid Overlap', desc: 'Some process maturity but low agility; change is resisted or slow' },
  '3-3': { title: 'Balanced Low', desc: 'Basic structure and adaptability; can handle minor changes, struggles with major ones' },
  '3-4': { title: 'Stagnant/Chaotic Overlap', desc: 'Moderate agility but process weaknesses cause inconsistent results' },
  '3-5': { title: 'Chaotic', desc: 'High adaptability, moderate processes; may waste effort due to uncoordinated work' },
  '4-1': { title: 'Rigid', desc: 'Stronger processes emerging but little flexibility; risk of stagnation' },
  '4-2': { title: 'Rigid', desc: 'Solid processes but slow or resistant to change; priorities take too long to shift' },
  '4-3': { title: 'Balanced Mid', desc: 'Structure and adaptability balanced at mid-level; capable of handling routine disruptions' },
  '4-4': { title: 'Overlap (Rigid/Dynamic)', desc: 'Well-structured and adaptable, but could strengthen speed or consistency' },
  '4-5': { title: 'Dynamic', desc: 'Highly adaptable with solid processes; could refine learning and coordination' },
  '5-1': { title: 'Rigid', desc: 'Fully developed processes but no agility; organisation is locked into fixed patterns' },
  '5-2': { title: 'Rigid', desc: 'Very strong processes but limited adaptability; risks irrelevance under change' },
  '5-3': { title: 'Overlap (Rigid/Dynamic)', desc: 'Excellent processes and moderate adaptability; can adapt but slower than leaders' },
  '5-4': { title: 'Dynamic', desc: 'High-performing processes and strong adaptability; well-prepared for most disruptions' },
  '5-5': { title: 'Dynamic', desc: 'Optimal structure and adaptability; resilient, fast, and consistent under any change' }
};

// --- LOGIC ENGINE ---
const getResult = (pmi, aci) => {
  const key = `${pmi}-${aci}`;
  return STATE_DATA[key] || { title: 'Unknown', desc: '' };
};

// UI Color Helper
const getScoreColorClass = (score) => {
  switch (score) {
    case 1: return "bg-slate-100 text-slate-400";
    case 2: return "bg-red-100 text-red-800";
    case 3: return "bg-red-300 text-white"; // Light Red
    case 4: return "bg-[#f37f73] text-white"; // Brand Coral
    case 5: return "bg-[#991b1b] text-white"; // Deep Red
    default: return "bg-slate-100 text-slate-800";
  }
};

// Helper: Convert SVG String to High-Res Image Data URL for PDF
const rasterizeSVG = (svgUri, width, height) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * 2; 
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = svgUri;
  });
};

// --- CUSTOM MARKER (With Heavy Shadow) ---
const CustomMarker = (props) => {
  const { cx, cy } = props;
  const size = 30;
  return (
    <svg 
      x={cx - size / 2} 
      y={cy - size / 2} 
      width={size} 
      height={size} 
      viewBox="0 0 1000 1000" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className="overflow-visible" 
      style={{ filter: "drop-shadow(20px 20px 30px rgba(0, 0, 0, .7))" }}
    >
      <rect x="50" y="50" width="900" height="900" rx="450" ry="450" fill="#fff"/>
      <path d="M369.46,533.38c0,43.16,46.74,70.12,84.1,48.5l305.44-176.72,72.05-41.71c-53.6-129.82-181.28-221.26-330.4-221.52-195.07-.34-355.94,157.88-358.67,352.93-2.8,200.1,158.57,363.19,358.02,363.19s358.06-160.31,358.06-358.06h-40.42c-22.48,0-41.22,16.7-44.37,38.96-18.93,133.98-134.07,237.05-273.28,237.05-84.85,0-160.73-38.32-211.36-98.57l.08-.05c-43.01-50.81-68.02-117.34-65.04-189.79,5.95-144.65,124.91-261.19,269.66-264.32,90.18-1.95,170.75,39.4,222.47,104.66-.1-.11-.22-.2-.32-.31l-346.04,199.13v6.62Z" fill="#f37f72"/>
    </svg>
  );
};

// --- COMPONENT ---
const App = () => {
  const [scores, setScores] = useState(INDICATORS.reduce((acc, ind) => ({ ...acc, [ind.id]: 3 }), {}));
  const [userName, setUserName] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  
  const chartRef = useRef(null);

  // Load Google Fonts (Raleway)
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Raleway:wght@400;700;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  const handleScoreChange = (id, val) => {
    setScores(prev => ({ ...prev, [id]: parseInt(val) }));
  };

  const onCaptchaChange = (token) => {
    setCaptchaToken(token);
  };

  const results = useMemo(() => {
    let pmiSum = 0, pmiCount = 0;
    let aciSum = 0, aciCount = 0;

    INDICATORS.forEach(ind => {
      const val = scores[ind.id];
      if (ind.axis === 'PMI') {
        pmiSum += val; pmiCount++;
      } else if (ind.axis === 'ACI') {
        aciSum += val; aciCount++;
      } else if (ind.axis === 'BOTH') {
        pmiSum += (val * 0.5); pmiCount += 0.5;
        aciSum += (val * 0.5); aciCount += 0.5;
      }
    });

    const pmiScore = Number((pmiSum / pmiCount).toFixed(2));
    const aciScore = Number((aciSum / aciCount).toFixed(2));
    const pmiGrid = Math.max(1, Math.min(5, Math.round(pmiScore)));
    const aciGrid = Math.max(1, Math.min(5, Math.round(aciScore)));

    const resultData = getResult(pmiGrid, aciGrid);

    return { pmiScore, aciScore, pmiGrid, aciGrid, state: resultData.title, desc: resultData.desc };
  }, [scores]);

  // --- PDF GENERATOR ---
  const handleDownloadPDF = async () => {
    if (!userName.trim()) {
      alert("Please enter your name before downloading.");
      return;
    }
    if (!captchaToken) {
        alert("Please complete the reCAPTCHA challenge.");
        return;
    }
    
    setIsGeneratingPdf(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      
      // 1. Prepare Logos & Icons
      const headerLogoPng = await rasterizeSVG(HEADER_LOGO_DATA_URI, 1000, 200);
      const ccLogoPng = await rasterizeSVG(CC_LOGO_DATA_URI, 304, 73);
      const linkIconPng = await rasterizeSVG(LINK_ICON_URI, 24, 24);
      
      // --- HEADER ---
      if (headerLogoPng) {
        pdf.addImage(headerLogoPng, 'PNG', margin, 15, 55, 11);
      } else {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(20);
        pdf.text("BIMe Initiative", margin, 22);
      }

      // Metadata
      pdf.setFontSize(9);
      pdf.setTextColor(100);
      pdf.setFont("helvetica", "normal");
      
      const dateText = `Date: ${new Date().toLocaleDateString()}`;
      const userText = `Assessed By: ${userName}`;
      
      pdf.text(dateText, pageWidth - margin, 18, { align: "right" });
      pdf.setFont("helvetica", "bold");
      pdf.text(userText, pageWidth - margin, 23, { align: "right" });

      // Title Line
      pdf.setDrawColor(226, 232, 240); 
      pdf.line(margin, 30, pageWidth - margin, 30);
      
      // --- STYLED TITLE + LINK ICON ---
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(50);
      pdf.text(EPISODE_TITLE_PREFIX, margin, 38);
      
      const prefixWidth = pdf.getTextWidth(EPISODE_TITLE_PREFIX);
      pdf.setFont("helvetica", "normal");
      pdf.text(EPISODE_TITLE_MAIN, margin + prefixWidth + 2, 38);
      
      // Link Icon
      const mainTitleWidth = pdf.getTextWidth(EPISODE_TITLE_MAIN);
      const iconX = margin + prefixWidth + mainTitleWidth + 3;
      pdf.addImage(linkIconPng, 'PNG', iconX, 35, 3, 3);
      pdf.link(margin, 34, 150, 5, { url: POST_URL });

      // --- CHART ---
      if (chartRef.current) {
        const canvas = await html2canvas(chartRef.current, { scale: 2, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const chartSize = 100;
        const xPos = (pageWidth - chartSize) / 2;
        pdf.addImage(imgData, 'PNG', xPos, 45, chartSize, chartSize);
      }

      // --- RESULTS ---
      const boxY = 150;
      pdf.setFontSize(10);
      pdf.setTextColor(150);
      pdf.text("CALCULATED MICROSTATE", pageWidth / 2, boxY, { align: "center" });
      
      pdf.setFontSize(14);
      pdf.setTextColor(0);
      pdf.setFont("helvetica", "bold");
      pdf.text(results.state.toUpperCase(), pageWidth / 2, boxY + 7, { align: "center" });

      // Descriptor
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(80);
      pdf.text(results.desc, pageWidth / 2, boxY + 13, { align: "center", maxWidth: 140 });

      const scoreY = 175;
      pdf.setFontSize(9);
      pdf.setTextColor(100);
      pdf.text(`PMI SCORE: ${results.pmiScore}`, pageWidth / 2 - 30, scoreY, { align: "center" });
      pdf.text(`ACI SCORE: ${results.aciScore}`, pageWidth / 2 + 30, scoreY, { align: "center" });

      // --- DETAILED BREAKDOWN (SORTED) ---
      const listStartY = 190;
      pdf.setDrawColor(200);
      pdf.line(margin, listStartY - 5, pageWidth - margin, listStartY - 5);
      
      pdf.setFontSize(9);
      pdf.setTextColor(50);
      pdf.setFont("helvetica", "bold");
      pdf.text("DETAILED INDICATOR SCORES", margin, listStartY);

      let yLeft = listStartY + 8;
      let yRight = listStartY + 8;
      const col2X = 110; 

      const sortedIndicators = [...INDICATORS].sort((a, b) => {
        const numA = parseInt(a.code.split('-')[1]);
        const numB = parseInt(b.code.split('-')[1]);
        return numA - numB;
      });

      sortedIndicators.forEach((ind, index) => {
        const isLeftCol = index < 7;
        const xPos = isLeftCol ? margin : col2X;
        const yPos = isLeftCol ? yLeft : yRight;
        
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(50);
        pdf.text(ind.code, xPos, yPos);

        const scoreVal = scores[ind.id];
        
        if (scoreVal === 1) pdf.setFillColor(241, 245, 249);
        else if (scoreVal === 2) pdf.setFillColor(254, 226, 226);
        else if (scoreVal === 3) pdf.setFillColor(252, 165, 165);
        else if (scoreVal === 4) pdf.setFillColor(243, 127, 115);
        else if (scoreVal === 5) pdf.setFillColor(153, 27, 27);

        pdf.roundedRect(xPos + 18, yPos - 3, 6, 4, 1, 1, 'F');
        
        if (scoreVal >= 3) pdf.setTextColor(255);
        else pdf.setTextColor(50);
        
        pdf.setFontSize(7);
        pdf.text(String(scoreVal), xPos + 21, yPos, { align: "center" });

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(100);
        const cleanTitle = ind.title.length > 40 ? ind.title.substring(0, 38) + "..." : ind.title;
        pdf.text(cleanTitle, xPos + 28, yPos);

        if (isLeftCol) yLeft += 7; else yRight += 7;
      });

      // --- CREATIVE COMMONS FOOTER (ADJUSTED HEIGHT) ---
      // Increased footerHeight to 18mm to fit 3 lines comfortably
      const footerHeight = 18; 
      const footerY = pageHeight - 28; // Moved up slightly
      
      pdf.setFillColor(248, 250, 252); 
      pdf.roundedRect(margin, footerY, pageWidth - (margin * 2), footerHeight, 2, 2, 'F');
      
      if (ccLogoPng) {
        // Logo vertical center in box
        pdf.addImage(ccLogoPng, 'PNG', margin + 3, footerY + 5, 25, 6);
        pdf.link(margin + 3, footerY + 5, 25, 6, { url: "https://creativecommons.org/licenses/by-nc-sa/4.0/deed.en" });
      }

      pdf.setFontSize(7);
      pdf.setTextColor(100);
      const textX = margin + 35;
      const line1Y = footerY + 6;
      const line2Y = footerY + 10;
      const line3Y = footerY + 14;

      // Line 1
      const t1 = "This microtool is provided by ";
      const t2 = "BIMe Initiative";
      const t3 = " for educational purposes under a";

      let cursorX = textX;
      pdf.text(t1, cursorX, line1Y);
      cursorX += pdf.getTextWidth(t1);
      
      pdf.setTextColor(50);
      pdf.text(t2, cursorX, line1Y);
      pdf.line(cursorX, line1Y + 0.5, cursorX + pdf.getTextWidth(t2), line1Y + 0.5);
      pdf.link(cursorX, line1Y - 2, pdf.getTextWidth(t2), 3, { url: "https://bimexcellence.org" });
      cursorX += pdf.getTextWidth(t2);

      pdf.setTextColor(100);
      pdf.text(t3, cursorX, line1Y);

      // Line 2
      cursorX = textX;
      const l2_p1 = "Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International  ";
      const l2_link = "deed.";

      pdf.text(l2_p1, cursorX, line2Y);
      cursorX += pdf.getTextWidth(l2_p1);

      pdf.setTextColor(50);
      pdf.text(l2_link, cursorX, line2Y);
      pdf.line(cursorX, line2Y + 0.5, cursorX + pdf.getTextWidth(l2_link), line2Y + 0.5);
      pdf.link(cursorX, line2Y - 2, pdf.getTextWidth(l2_link), 3, { url: "https://creativecommons.org/licenses/by-nc-sa/4.0/deed.en" });

      // Line 3 (Version - Left Aligned)
      pdf.setTextColor(150);
      pdf.text(VERSION_INFO, textX, line3Y);

      const now = new Date();
      const ts = now.toISOString().slice(2,10).replace(/-/g,'') + 
                 String(now.getHours()).padStart(2,'0') + 
                 String(now.getMinutes()).padStart(2,'0');
      const safeName = userName.replace(/\s+/g, '_');
      pdf.save(`Adaptive_Maturity_${safeName}_${ts}.pdf`);

    } catch (err) {
      console.error(err);
      alert("Error generating PDF.");
    }
    setIsGeneratingPdf(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-2 md:p-4 font-sans text-slate-800 flex justify-center items-start" style={{ fontFamily: 'Raleway, sans-serif' }}>
      <div className="w-full max-w-6xl border border-slate-200 shadow-sm bg-white rounded-none">
        
        {/* APP HEADER */}
        <div className="border-b border-slate-200 p-4 md:p-5 bg-white flex justify-between items-center">
          <div>
            <h1 className="text-lg md:text-xl font-black text-slate-800 uppercase tracking-tight">Adaptive Maturity Assessment</h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1 font-bold">Rate the 13 indicators (1-5) to identify your State.</p>
          </div>
          <img src={HEADER_LOGO_DATA_URI} alt="BIMe Initiative" className="h-8 md:h-10 w-auto shrink-0 object-right" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          
          {/* --- RESULTS COLUMN --- */}
          <div className="lg:col-span-5 order-1 lg:order-2 bg-slate-50 p-4 md:p-6 flex flex-col lg:sticky lg:top-0 h-fit">
            
             <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 h-full flex flex-col">
                
                {/* Result Header */}
                <div className="mb-2 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Calculated Microstate</div>
                  <div className="text-lg md:text-xl font-black text-slate-800 uppercase leading-none" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>{results.state}</div>
                  <div className="text-xs text-slate-500 mt-2 italic px-4 leading-relaxed">{results.desc}</div>
                </div>

                {/* THE CHART */}
                <div ref={chartRef} className="bg-white p-2 border border-slate-200 shadow-sm aspect-square relative mb-4 rounded-sm ml-6"> 
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" dataKey="x" domain={[0, 6]} hide />
                      <YAxis type="number" dataKey="y" domain={[0, 6]} hide />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{borderRadius: 0, borderColor: BRAND_COLOR}} />
                      
                      {/* Zones */}
                      <ReferenceArea x1={0} x2={3} y1={3} y2={6} fill="#86efac" fillOpacity={0.2} stroke="none" />
                      <ReferenceArea x1={3} x2={6} y1={3} y2={6} fill="#67e8f9" fillOpacity={0.2} stroke="none" />
                      <ReferenceArea x1={0} x2={3} y1={0} y2={3} fill="#fde047" fillOpacity={0.2} stroke="none" />
                      <ReferenceArea x1={3} x2={6} y1={0} y2={3} fill="#fda4af" fillOpacity={0.2} stroke="none" />
                      <ReferenceLine x={3} stroke="#64748b" strokeWidth={2} />
                      <ReferenceLine y={3} stroke="#64748b" strokeWidth={2} />
                      
                      {/* CUSTOM MARKER */}
                      <Scatter 
                        name="Pos" 
                        data={[{ x: results.pmiScore, y: results.aciScore }]} 
                        shape={<CustomMarker />} 
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                  
                  {/* Quadrant Labels */}
                  <div className="absolute inset-0 pointer-events-none" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                      <div className="absolute top-[25%] left-[25%] -translate-x-1/2 -translate-y-1/2 text-sm md:text-base font-black text-green-900/20 uppercase text-center">CHAOTIC</div>
                      <div className="absolute top-[25%] right-[25%] translate-x-1/2 -translate-y-1/2 text-sm md:text-base font-black text-cyan-900/20 uppercase text-center">DYNAMIC</div>
                      <div className="absolute bottom-[25%] left-[25%] -translate-x-1/2 translate-y-1/2 text-sm md:text-base font-black text-yellow-900/20 uppercase text-center">STAGNANT</div>
                      <div className="absolute bottom-[25%] right-[25%] translate-x-1/2 translate-y-1/2 text-sm md:text-base font-black text-red-900/20 uppercase text-center">RIGID</div>
                  </div>

                  <div className="absolute bottom-1 w-full text-center text-[8px] font-bold text-slate-400 uppercase tracking-widest">Process Maturity &rarr;</div>
                  <div className="absolute top-1/2 -left-10 transform -translate-y-1/2 -rotate-90 text-[8px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Adaptive Capacity &rarr;</div>
                </div>

                {/* Score Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white p-3 border border-slate-200 text-center rounded-sm">
                     <div className="text-[9px] font-bold text-slate-400 uppercase">PMI Score</div>
                     <div className="text-xl font-black text-slate-800">{results.pmiScore}</div>
                  </div>
                  <div className="bg-white p-3 border border-slate-200 text-center rounded-sm">
                     <div className="text-[9px] font-bold text-slate-400 uppercase">ACI Score</div>
                     <div className="text-xl font-black text-slate-800">{results.aciScore}</div>
                  </div>
                </div>

                {/* --- CONTROLS --- */}
                <div className="bg-white p-4 border border-slate-200 mb-4 space-y-3">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                    <User size={14} /> Report Settings
                  </div>
                  <input 
                    type="text" 
                    placeholder="Enter Name (Required for PDF)..." 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full border border-slate-300 p-2 text-sm focus:outline-none focus:border-[#f37f73] font-sans"
                  />
                  
                  <div className="flex justify-center my-2">
                    <ReCAPTCHA
                        sitekey={RECAPTCHA_SITE_KEY}
                        onChange={onCaptchaChange}
                    />
                  </div>

                  <button 
                    onClick={handleDownloadPDF}
                    disabled={isGeneratingPdf}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors"
                  >
                    {isGeneratingPdf ? 'Generating PDF...' : <><Download size={14} /> Download PDF Report</>}
                  </button>
                </div>

                <button 
                  onClick={() => { setScores(INDICATORS.reduce((acc, ind) => ({ ...acc, [ind.id]: 3 }), {})); setUserName(''); setCaptchaToken(null); }}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors"
                >
                  <RotateCcw size={14} /> Reset Assessment
                </button>
                
                {/* Footer Version Info */}
                <div className="text-[10px] text-slate-300 text-center mt-4 font-sans">
                  {VERSION_INFO}
                </div>

             </div>
          </div>

          {/* --- INPUTS COLUMN --- */}
          <div className="lg:col-span-7 order-2 lg:order-1 p-4 md:p-5 bg-white">
            <div className="space-y-6">
              {['PMI', 'ACI', 'BOTH'].map(axis => (
                <div key={axis}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-px bg-slate-200 flex-grow"></div>
                    <h3 className="text-[14px] font-bold uppercase tracking-widest text-[#f37f73]">
                      {axis === 'BOTH' ? 'Shared (PMI + ACI)' : axis === 'PMI' ? 'Process Maturity' : 'Adaptive Capacity'}
                    </h3>
                    <div className="h-px bg-slate-200 flex-grow"></div>
                  </div>
                  <div className="space-y-5">
                    {INDICATORS.filter(i => i.axis === axis).map(ind => (
                      <div key={ind.id} className="relative">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2 group relative max-w-[85%]">
                             <div className="flex items-center gap-1 shrink-0">
                                <label className="text-xs font-bold text-slate-700 cursor-help">{ind.code}</label>
                                <HelpCircle size={14} className="text-slate-300 group-hover:text-[#f37f73] transition-colors cursor-help" />
                             </div>
                             <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-900 text-white text-[10px] leading-relaxed shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none font-sans">
                                <span className="font-bold block mb-1 text-[#f37f73]">{ind.title}</span>
                                {ind.desc}
                                <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                             </div>
                             <span className="text-[10px] uppercase font-bold text-slate-400 truncate">{ind.title}</span>
                          </div>
                          {/* Color Coded Score Bubble */}
                          <span className={`text-xs font-bold px-2 py-0.5 min-w-[24px] text-center rounded-sm shadow-sm ${getScoreColorClass(scores[ind.id])}`}>
                            {scores[ind.id]}
                          </span>
                        </div>
                        <input type="range" min="1" max="5" step="1" value={scores[ind.id]} onChange={(e) => handleScoreChange(ind.id, e.target.value)} className="w-full h-2 bg-slate-100 appearance-none cursor-pointer accent-[#c4c4c4] rounded-full hover:bg-slate-200 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default App;