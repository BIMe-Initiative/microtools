import React, { useState, useEffect } from 'react';
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
            state: 'Chaotic', // Switch color context
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
  // Default: Closed
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  const toggleOpen = () => setIsOpen(!isOpen);

  // Color Logic
  const themeColor = node.state ? STATE_THEMES[node.state] : (inheritedTheme || STATE_THEMES.default);

  // Styles
  const cardBg = level === 0 ? themeColor : '#ffffff';
  const cardText = level === 0 ? '#ffffff' : '#334155'; // Slate-700
  const borderStyle = level === 0 ? {} : { borderLeft: `4px solid ${themeColor}` };

  return (
    // pl-8 creates the indentation for the hierarchy
    <div className="relative pl-8">
      
      {/* --- CONNECTORS --- */}
      {level > 0 && (
        <>
          {/* 1. Vertical Rail */}
          <div 
            className="absolute left-0 w-[2px] bg-slate-300"
            style={{ 
              // Pull top up by 20px to overlap the bottom margin of the previous sibling
              top: '-20px', 
              // Extend height to cover this node plus spacing
              height: isLast ? '46px' : 'calc(100% + 20px)'
            }}
          />
          {/* 2. Horizontal Rung */}
          <div 
            className="absolute left-0 top-[26px] w-8 h-[2px] bg-slate-300"
          />
        </>
      )}

      {/* --- THE CARD --- */}
      <div className="mb-6 relative z-10">
        <div 
          className={clsx(
            "relative flex items-center p-4 transition-all duration-300 w-full max-w-lg cursor-default",
            "hover:scale-[1.02] hover:shadow-lg shadow-sm bg-white"
          )}
          style={{
            backgroundColor: cardBg,
            color: cardText,
            ...borderStyle,
            boxShadow: level > 0 ? '0 1px 3px rgba(0,0,0,0.1)' : '0 4px 6px rgba(0,0,0,0.1)'
          }}
        >
          {/* Expand/Collapse Button */}
          {hasChildren && (
            <button
              onClick={toggleOpen}
              className="mr-4 p-1 rounded-full flex-shrink-0 transition-transform active:scale-95"
              style={{ 
                backgroundColor: level === 0 ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                color: level === 0 ? 'white' : themeColor
              }}
            >
              {isOpen ? <Minus size={14} /> : <Plus size={14} />}
            </button>
          )}

          {/* Content */}
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

        {/* --- RECURSIVE CHILDREN --- */}
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
  // Inject Raleway Font
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  return (
    <div 
      className="min-h-screen p-4 md:p-8 font-sans"
      style={{ 
        fontFamily: "'Raleway', sans-serif",
        backgroundColor: '#fafafa'
      }}
    >
      <div 
        className="max-w-5xl mx-auto bg-white min-h-[800px] shadow-sm relative flex flex-col"
        style={{ border: '1px solid #d3d3d3' }}
      >
        
        {/* HEADER: Flex-row ensures side-by-side on all screens */}
        {/* items-start aligns logo to top-right on mobile multi-line titles */}
        <div className="p-6 border-b border-gray-200 bg-white sticky top-0 z-50 flex flex-row justify-between items-start gap-4">
          
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight leading-tight">
            Adaptive Maturity States<span className="font-semibold text-slate-500 block md:inline md:ml-2">Transition Actions</span>
          </h1>

          {/* LINKING TO LOCAL PUBLIC LOGO */}
          <img 
            src="/BIMei-Logo-Long.svg" 
            alt="BIMe Initiative" 
            className="h-8 md:h-10 w-auto object-contain flex-shrink-0" 
          />
        </div>

        {/* CONTENT */}
        <div className="p-4 md:p-8 pb-16 overflow-x-auto">
          {MINDMAP_DATA.map((rootNode, index) => (
            <div key={rootNode.id} className="mb-12 last:mb-0">
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