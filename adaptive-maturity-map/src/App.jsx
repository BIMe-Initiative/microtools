import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import { clsx } from 'clsx';

// --- CONFIGURATION ---
const STATE_THEMES = {
  Stagnant: '#dfc024',  // Yellow
  Chaotic: '#8dc63f',   // Green
  Dynamic: '#5ec6c8',   // Blue
  Rigid: '#ed1f79',     // Magenta
  default: '#94a3b8'    // Slate Grey
};

// --- LOGO SVG ---
const LOGO_SVG = `
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
const LOGO_URI = `data:image/svg+xml;base64,${btoa(LOGO_SVG)}`;

// --- DATA STRUCTURE ---
const MINDMAP_DATA = [
  {
    id: 'stagnant',
    title: 'Escaping the Stagnant State',
    description: 'Moving away from Low Adaptive Capacity & Low Process Maturity. Goal: Break inertia.',
    state: 'Stagnant',
    children: [
      {
        id: 'path-a',
        title: 'Path A: Stagnant → Chaotic → Dynamic',
        description: 'Prioritise Adaptive Capacity (Agility & Vitality) first. Faster innovation, higher risk.',
        children: [
          {
            id: 'phase-disrupt',
            title: 'Phase: Introduce Disruptions (Stagnant → Chaotic)',
            state: 'Chaotic', 
            children: [
              {
                id: 'empower',
                title: 'Empowering Champions',
                children: [
                  { 
                    id: 'agents', 
                    title: 'Identify Potential Change Agents',
                    children: [
                      { id: 'survey', title: 'Survey staff for hidden skills (coding, data, etc.)' },
                      { id: 'locate', title: 'Locate frustrated high-performers' }
                    ]
                  },
                  {
                    id: 'autonomy',
                    title: 'Allocate Autonomy & Resources',
                    children: [
                      { id: 'exempt', title: 'Exempt champions from standard approval chains' },
                      { id: 'budget', title: 'Allocate a "Curiosity Budget" for non-project work' }
                    ]
                  }
                ]
              },
              {
                id: 'experiments',
                title: 'Legitimising Experimentation',
                children: [
                  { id: 'sandbox', title: "Create 'Innovation Sandboxes' (Safe-to-fail zones)" },
                  { id: 'failure', title: "Normalise Failure (Celebrate lessons learned)" }
                ]
              }
            ]
          },
          {
            id: 'phase-systems',
            title: 'Phase: Set Up Systems (Chaotic → Dynamic)',
            state: 'Dynamic',
            children: [
              { id: 'harvest', title: 'Harvest Lessons-learned from pilots' },
              { id: 'scale', title: 'Scale Success (Diffuse tools across org)' }
            ]
          }
        ]
      },
      {
        id: 'path-b',
        title: 'Path B: Stagnant → Rigid → Dynamic',
        description: 'Prioritise Process Maturity first. Builds stability but slows change.',
        children: [
          {
            id: 'phase-structure',
            title: 'Phase: Generate Structures (Stagnant → Rigid)',
            state: 'Rigid',
            children: [
              { id: 'codify', title: 'Codify Core Processes' },
              { id: 'gov', title: 'Centralise Governance' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'rigid-escape',
    title: 'Loosening the Rigid State',
    description: 'Increase Agility without losing stability (Rigid → Dynamic).',
    state: 'Rigid',
    children: [
      {
        id: 'action-rules',
        title: 'Action: Decrease Rules & Increase Flexibility',
        children: [
          {
            id: 'decentralise',
            title: 'Decentralising Decision-Making',
            children: [
              { id: 'matrices', title: 'Review Authority Matrices (Remove bottlenecks)' },
              { id: 'controls', title: 'Remove Non-Value-Add Controls' }
            ]
          },
          {
            id: 'empower-teams',
            title: 'Empowering Teams',
            children: [
              { id: 'boundaries', title: 'Replace prescriptive rules with guiding principles' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'chaotic-escape',
    title: 'Organising the Chaotic State',
    description: 'Introduce discipline without killing spirit (Chaotic → Dynamic).',
    state: 'Chaotic',
    children: [
      {
        id: 'action-systems',
        title: 'Action: Setting Up Systems',
        children: [
          { id: 'prioritise', title: 'Prioritise Initiatives (Strategic Roadmap)' },
          { id: 'light-gov', title: 'Establish Light Governance (Stage-gates)' },
          { id: 'knowledge', title: 'Build a Knowledge Hub' }
        ]
      }
    ]
  }
];

// --- COMPONENT: TREE NODE ---
const MindMapNode = ({ node, isLast, level = 0, inheritedTheme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  const toggleOpen = (e) => {
    e.stopPropagation(); 
    if (hasChildren) setIsOpen(!isOpen);
  };

  const themeColor = node.state ? STATE_THEMES[node.state] : (inheritedTheme || STATE_THEMES.default);
  const cardBg = level === 0 ? themeColor : '#ffffff';
  const cardText = level === 0 ? '#ffffff' : '#334155'; 
  const borderStyle = level === 0 ? {} : { borderLeft: `4px solid ${themeColor}` };

  return (
    <div className="relative pl-8">
      {/* CONNECTORS */}
      {level > 0 && (
        <>
          <div 
            className="absolute left-0 w-[2px] bg-slate-300"
            style={{ 
              top: '-24px', 
              height: isLast ? '50px' : 'calc(100% + 24px)'
            }}
          />
          <div className="absolute left-0 top-[26px] w-8 h-[2px] bg-slate-300" />
        </>
      )}

      {/* CARD */}
      <div className="mb-6 relative z-10 group">
        <div 
          onClick={toggleOpen}
          className={clsx(
            "relative flex items-center p-4 transition-all duration-300 w-full max-w-[95%] shadow-sm bg-white select-none",
            hasChildren ? "cursor-pointer hover:scale-[1.01] hover:shadow-md" : "cursor-default"
          )}
          style={{
            backgroundColor: cardBg,
            color: cardText,
            ...borderStyle,
            boxShadow: level > 0 ? '0 1px 3px rgba(0,0,0,0.1)' : '0 4px 6px rgba(0,0,0,0.1)'
          }}
        >
          {hasChildren && (
            <div
              className="mr-4 p-1 rounded-full flex-shrink-0 transition-transform duration-300"
              style={{ 
                backgroundColor: level === 0 ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                color: level === 0 ? 'white' : themeColor,
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
              }}
            >
              {isOpen ? <Minus size={14} /> : <Plus size={14} />}
            </div>
          )}

          <div className="flex-1">
            <h3 className={clsx("leading-tight", level === 0 ? "font-bold text-lg" : "font-semibold text-sm")}>
              {node.title}
            </h3>
            {node.description && (
              <p className={clsx(
                "text-xs mt-1 leading-relaxed font-semibold", 
                level === 0 ? "opacity-90" : "opacity-60"
              )}>
                {node.description}
              </p>
            )}
          </div>
        </div>

        {/* CHILDREN */}
        <AnimatePresence>
          {isOpen && hasChildren && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2"> 
                {node.children.map((child, index) => (
                  <MindMapNode 
                    key={child.id || index} 
                    node={child} 
                    level={level + 1}
                    inheritedTheme={themeColor} 
                    isLast={index === node.children.length - 1} 
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
const App = () => {
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  // --- AUTO RESIZE LOGIC (PostMessage) ---
  // This sends the height to the parent iframe
  useEffect(() => {
    const sendHeight = () => {
      // Small buffer (+20) prevents scrollbars
      const height = document.documentElement.scrollHeight + 20;
      window.parent.postMessage({ type: 'resize-iframe-map', height: height }, '*');
    };

    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);
    
    // Also trigger on load
    sendHeight();

    return () => observer.disconnect();
  }, []);

  return (
    // Changed min-h-screen to h-fit to allow shrinking
    <div 
      className="w-full h-fit p-4 md:p-8 font-sans"
      style={{ 
        fontFamily: "'Raleway', sans-serif",
        backgroundColor: '#fafafa'
      }}
    >
      <div 
        className="max-w-5xl mx-auto bg-white shadow-sm relative flex flex-col h-fit"
        style={{ border: '1px solid #d3d3d3' }}
      >
        
   {/* HEADER */}
        <div className="p-6 border-b border-gray-200 bg-white sticky top-0 z-50 flex flex-row justify-between items-start gap-4">
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight leading-tight">
            Adaptive Maturity States
            <span className="font-light text-slate-500 ml-0 md:ml-2 block md:inline">
              Explore transitional activities and steps
            </span>
          </h1>
          <img 
            src="/BIMei-Logo-Long.svg" 
            alt="BIMe Initiative" 
            className="h-8 md:h-10 w-auto object-contain flex-shrink-0" 
          />
        </div>

        {/* CONTENT */}
        <div className="p-4 md:p-8 pb-16 overflow-x-auto">
          {MINDMAP_DATA.map((rootNode, index) => (
            <div key={rootNode.id} className="mb-4 last:mb-0">
              <MindMapNode 
                node={rootNode} 
                isLast={true} 
              />
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div className="p-3 border-t border-gray-200 bg-gray-50 mt-auto">
          <p className="text-[10px] text-gray-500 text-center font-medium">
            BIMe Initiative | Adaptive Maturity State Transition Mindmap v1.0 (Dec 2025)
          </p>
        </div>

      </div>
    </div>
  );
};

export default App;