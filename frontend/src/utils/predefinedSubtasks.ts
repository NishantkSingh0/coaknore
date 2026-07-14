// Predefined subtasks for each department with descriptions
export interface PredefinedSubtask {
  title: string
  description: string
}

export const DEPARTMENT_SUBTASKS: Record<string, PredefinedSubtask[]> = {
  upholstery: [
    {
      title: 'Nivar',
      description: 'Initial preparation and nivar work for upholstery foundation'
    },
    {
      title: 'Spring Work',
      description: 'Installation and arrangement of springs for seating support'
    },
    {
      title: 'Foam Cutting/Fixing',
      description: 'Cutting foam to required dimensions and fixing it to the frame'
    },
    {
      title: 'Fabric Wrapping/Cutting',
      description: 'Cutting fabric pieces and wrapping them around the furniture components'
    },
    {
      title: 'Stitching & Piping',
      description: 'Stitching fabric seams and creating decorative piping edges'
    },
    {
      title: 'IQC',
      description: 'Initial Quality Check - inspection of materials and components before use'
    }
  ],
  stone: [
    {
      title: 'Stone Selection',
      description: 'Selection of appropriate stone material based on specifications'
    },
    {
      title: 'Marking',
      description: 'Marking the stone for cutting according to design dimensions'
    },
    {
      title: 'Cutting',
      description: 'Cutting the stone to the marked dimensions'
    },
    {
      title: 'CNC / Profile Cutting',
      description: 'Precision cutting using CNC machines or profile cutting tools'
    },
    {
      title: 'Edge Profiling / Grinding',
      description: 'Shaping and smoothing the edges of stone pieces'
    },
    {
      title: 'Hole & Groove Machining',
      description: 'Drilling holes and creating grooves for fittings and connections'
    },
    {
      title: 'Stone Filling',
      description: 'Filling cracks and imperfections with matching stone filler'
    },
    {
      title: 'Surface Polishing',
      description: 'Polishing the stone surface to achieve the desired finish'
    },
    {
      title: 'Pasting / Fitting',
      description: 'Installing the stone pieces at their designated locations'
    },
    {
      title: 'Cleaning',
      description: 'Final cleaning of the stone surface after installation'
    },
    {
      title: 'IQC',
      description: 'Initial Quality Check - inspection of stone materials before processing'
    }
  ],
  polishing: [
    {
      title: 'Surface Inspection',
      description: 'Initial inspection of the surface to identify imperfections'
    },
    {
      title: 'Putty / Wood Filler',
      description: 'Applying putty or wood filler to fill cracks and holes'
    },
    {
      title: 'Sanding',
      description: 'Sanding the surface to smooth out imperfections'
    },
    {
      title: 'Primer Coat',
      description: 'Applying primer coat to prepare the surface for painting'
    },
    {
      title: 'Intermediate Sanding',
      description: 'Sanding between coats for smooth finish'
    },
    {
      title: 'Base Coat',
      description: 'Applying the base coat of paint or finish'
    },
    {
      title: 'Top Coat / PU / Melamine / Paint',
      description: 'Applying the final top coat with appropriate finish (PU, Melamine, or Paint)'
    },
    {
      title: 'Drying / Curing',
      description: 'Allowing sufficient time for the finish to dry and cure properly'
    },
    {
      title: 'Buffing / Touch-up',
      description: 'Buffing the surface and performing any necessary touch-ups'
    },
    {
      title: 'IQC',
      description: 'Initial Quality Check - inspection of materials before polishing process'
    }
  ],
  metal: [
    {
      title: 'Material Selection',
      description: 'Selection of appropriate metal material based on requirements'
    },
    {
      title: 'Cutting',
      description: 'Cutting metal pieces to required dimensions'
    },
    {
      title: 'Taping / 2D Cutting',
      description: 'Taping and performing 2D cutting operations'
    },
    {
      title: 'Bending',
      description: 'Bending metal pieces to achieve desired shapes'
    },
    {
      title: 'Drilling / Punching',
      description: 'Drilling holes or punching metal for connections'
    },
    {
      title: 'Welding',
      description: 'Welding metal components together'
    },
    {
      title: 'Grinding / Deburring',
      description: 'Grinding welds and removing sharp edges (deburring)'
    },
    {
      title: 'Sanding',
      description: 'Sanding metal surfaces for smooth finish'
    },
    {
      title: 'Surface Cleaning',
      description: 'Cleaning metal surfaces to remove dirt, oil, and debris'
    },
    {
      title: 'Casting (if applicable)',
      description: 'Casting metal components when required by design'
    },
    {
      title: 'Hardware Assembly',
      description: 'Assembling hardware components and fittings'
    },
    {
      title: 'IQC',
      description: 'Initial Quality Check - inspection of metal materials before processing'
    }
  ],
  carpentry: [
    {
      title: 'Cutting',
      description: 'Cutting wood components to required dimensions'
    },
    {
      title: 'Thickness Planning',
      description: 'Planning wood to achieve uniform thickness'
    },
    {
      title: 'Joint Preparation',
      description: 'Preparing joints for assembly (mortise, tenon, dowels, etc.)'
    },
    {
      title: 'CNC / Router Work',
      description: 'CNC machining or router operations for precise shaping'
    },
    {
      title: 'Assembly',
      description: 'Assembling wood components into the final structure'
    },
    {
      title: 'Hardware Fitting (Internal)',
      description: 'Installing internal hardware fittings and mechanisms'
    },
    {
      title: 'IQC',
      description: 'Initial Quality Check - inspection of wood materials before processing'
    }
  ],
  design: [
    {
      title: 'Requirement Review',
      description: 'Reviewing project requirements, specifications, and client expectations'
    },
    {
      title: 'Site Measurements Review',
      description: 'Verifying site dimensions and measurement details before design'
    },
    {
      title: 'Concept Development',
      description: 'Developing initial design concepts based on project requirements'
    },
    {
      title: '2D Layout Preparation',
      description: 'Preparing detailed 2D layouts, plans, elevations, and sections'
    },
    {
      title: '3D Model Creation',
      description: 'Creating accurate 3D models for visualization and production'
    },
    {
      title: 'Design Full Scale Print',
      description: 'Generating full-scale printouts or templates for production reference'
    },
    {
      title: 'Material & Finish Selection',
      description: 'Selecting materials, finishes, colors, and hardware as per design'
    },
    {
      title: 'Design Review',
      description: 'Conducting an internal review to ensure design accuracy and manufacturability'
    },
    {
      title: 'Client / Internal Approval',
      description: 'Obtaining final approval before releasing the design for production'
    },
    {
      title: 'Production Drawings Preparation',
      description: 'Preparing detailed manufacturing and fabrication drawings'
    },
    {
      title: 'BOM Preparation',
      description: 'Preparing the Bill of Materials required for manufacturing'
    },
    {
      title: 'CNC / Cutting Files Preparation',
      description: 'Generating CNC, DXF, or cutting files for production machines'
    },
    {
      title: 'Drawing & Files Release',
      description: 'Releasing approved drawings and production files to manufacturing departments'
    },
    {
      title: 'IQC',
      description: 'Initial Quality Check - inspection of wood materials before processing'
    }
  ]
}

/**
 * Matches a department name to predefined subtasks using case-insensitive comparison
 * and handles common variations/misspellings
 */
export function matchDepartmentToSubtasks(departmentName: string): PredefinedSubtask[] {
  if (!departmentName) return []
  
  const normalizedDept = departmentName.toLowerCase().trim()
  
  // Direct match
  if (DEPARTMENT_SUBTASKS[normalizedDept]) {
    return DEPARTMENT_SUBTASKS[normalizedDept]
  }
  
  // Handle common variations
  const variations: Record<string, string[]> = {
    upholstery: ['upholstery', 'upholster'],
    stone: ['stone', 'stones', 'marble', 'granite'],
    polishing: ['polishing', 'polish', 'finish', 'finishing'],
    metal: ['metal', 'metals', 'metalwork', 'metal work'],
    carpentry: ['carpentry', 'woodwork', 'wood work', 'woodworking']
  }
  
  for (const [key, variants] of Object.entries(variations)) {
    if (variants.some(variant => normalizedDept.includes(variant))) {
      return DEPARTMENT_SUBTASKS[key]
    }
  }
  
  // No match found
  return []
}
