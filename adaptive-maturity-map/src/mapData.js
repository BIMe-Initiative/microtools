export const mapData = [
  {
    id: "root-1",
    title: "Escaping the Stagnant State",
    type: "strategy",
    state: 'Stagnant',
    description: "Moving away from Low Adaptive Capacity & Low Process Maturity. Goal: Break inertia.",
    children: [
      {
        id: "1.1",
        title: "Path A: Stagnant → Chaotic → Dynamic",
        type: "path",
        description: "Prioritise Adaptive Capacity (Agility & Vitality) first. Faster innovation, higher risk.",
        children: [
          {
            id: "1.1.1",
            title: "Phase: Introduce Disruptions (Stagnant → Chaotic)",
            type: "phase",
            children: [
              {
                id: "1.1.1.1",
                title: "Empowering Champions",
                type: "activity",
                children: [
                  {
                    id: "task-a",
                    title: "Identify Potential Change Agents",
                    type: "task",
                    children: [
                      { id: "step-i", title: "Survey staff for hidden skills (coding, data, etc.)", type: "step" },
                      { id: "step-ii", title: "Locate frustrated high-performers", type: "step" }
                    ]
                  },
                  {
                    id: "task-b",
                    title: "Allocate Autonomy & Resources",
                    type: "task",
                    children: [
                      { id: "step-iii", title: "Exempt champions from standard approval chains", type: "step" },
                      { id: "step-iv", title: "Allocate a 'Curiosity Budget' for non-project work", type: "step" }
                    ]
                  }
                ]
              },
              {
                id: "1.1.1.2",
                title: "Legitimising Experimentation",
                type: "activity",
                children: [
                  {
                    id: "task-c",
                    title: "Create 'Innovation Sandboxes'",
                    type: "task",
                    description: "Safe-to-fail zones."
                  },
                  {
                    id: "task-d",
                    title: "Normalise Failure",
                    type: "task",
                    description: "Celebrate lessons learned from failed experiments."
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        id: "1.2",
        title: "Path B: Stagnant → Rigid → Dynamic",
        type: "path",
        description: "Prioritise Process Maturity (Consistency & Control) first. Slower, more stable foundation.",
        children: [
          {
            id: "1.2.1",
            title: "Phase: Generate Structures (Stagnant → Rigid)",
            type: "phase",
            children: [
              {
                id: "1.2.1.1",
                title: "Codifying Core Processes",
                type: "activity",
                children: [
                  { id: "task-e", title: "Audit Existing Workflows", type: "task" },
                  { id: "task-f", title: "Define Roles (RACI Matrices)", type: "task" }
                ]
              },
              {
                id: "1.2.1.2",
                title: "Mandating Uniform Templates",
                type: "activity"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "root-2",
    title: "Taming the Chaotic State",
    type: "strategy",
    state: 'Chaotic',
    description: "Introduce structure without killing Vitality (Chaotic → Dynamic).",
    children: [
        {
            id: "2.1",
            title: "Action: Setting Up Systems",
            type: "phase",
            children: [
                {
                    id: "2.1.1",
                    title: "Prioritising Initiatives",
                    type: "activity",
                    children: [
                        { id: "task-g", title: "Strategic Mapping (Score pilots against goals)", type: "task"},
                        { id: "task-h", title: "Pruning (Kill 'Zombie Projects')", type: "task"}
                    ]
                },
                {
                    id: "2.1.2",
                    title: "Establishing Light Governance",
                    type: "activity"
                }
            ]
        }
    ]
  },
  {
    id: "root-3",
    title: "Loosening the Rigid State",
    type: "strategy",
    state: 'Rigid',
    description: "Increase Agility without losing stability (Rigid → Dynamic).",
    children: [
        {
            id: "3.1",
            title: "Action: Decrease Rules & Increase Flexibility",
            type: "phase",
            children: [
                {
                    id: "3.1.1",
                    title: "Decentralising Decision-Making",
                    type: "activity",
                    children: [
                        { id: "task-i", title: "Review Authority Matrices (Remove bottlenecks)", type: "task"},
                        { id: "task-j", title: "Remove Non-Value-Add Controls", type: "task"}
                    ]
                }
            ]
        }
    ]
  }
];