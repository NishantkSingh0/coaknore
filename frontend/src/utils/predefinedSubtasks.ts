import { distance } from 'fastest-levenshtein'

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
      description: 'Internal Quality Check - inspection of materials and components before use'
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
      description: 'Internal Quality Check - inspection of stone materials before processing'
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
      description: 'Internal Quality Check - inspection of materials before polishing process'
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
      description: 'Internal Quality Check - inspection of metal materials before processing'
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
      description: 'Internal Quality Check - inspection of wood materials before processing'
    }
  ],
  assembly: [
    {
      title: 'Design Check',
      description: 'Verify that the assembled product matches the approved design and dimensions.'
    },
    {
      title: 'Hardware Check',
      description: 'Verify that all required hardware and fittings are available and defect-free.'
    },
    {
      title: 'Texture Check',
      description: 'Inspect the surface finish and texture for consistency and quality.'
    },
    {
      title: 'Finishing Check',
      description: 'Ensure all finishing work is complete and meets quality standards.'
    },
    {
      title: 'Material Check',
      description: 'Confirm that all materials and components match the project specifications.'
    },
    {
      title: 'FQC',
      description: 'Perform a final quality inspection before product approval.'
    },
    {
      title: 'Packaging & Dispatch',
      description: 'Package the completed product securely for storage or shipment.'
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
      description: 'Internal Quality Check - inspection of wood materials before processing'
    }
  ]
}

/**
 * Matches a department name to predefined subtasks using case-insensitive comparison
 * and handles common variations/misspellings
 */
const DEPARTMENT_ALIASES: Record<string, string[]> = {
  upholstery: [
    'upholstery',
    'upholster'
  ],
  stone: [
    'stone',
    'stonework',
    'stone mason',
    'stonemason'
  ],
  polishing: [
    'polishing',
    'polish',
    'finishing'
  ],
  metal: [
    'metal',
    'metalwork',
    'metal fabrication',
    'welder',
    'welding'
  ],
  carpentry: [
    'carpentry',
    'carpenter'
  ],
  design: [
    'design',
    'designer',
    'drawing',
    'drafting',
    'cad'
  ],
  assembly: [
    'assembly',
    'assemble',
    'assem',
    'asambli',
    'assambali',
    'assambaly',
    'Packing',
    'Packaging',
    'Assembly & Packing'
  ]
}

// Minimum alias length required to allow fuzzy (edit-distance) matching.
// Short aliases (e.g. "cad") are too error-prone for fuzzy scoring and are
// only matched via exact word-boundary comparison.
const MIN_FUZZY_ALIAS_LENGTH = 4

// Confidence threshold required to accept a fuzzy match
const FUZZY_MATCH_THRESHOLD = 0.9

function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
}

function similarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length)
  if (maxLength === 0) return 1

  return 1 - distance(a, b) / maxLength
}

// Flat alias -> department lookup, built once at module load, for fast
// exact/word-boundary matching before falling back to fuzzy scoring.
const ALIAS_TO_DEPARTMENT: Record<string, string> = {}
for (const [department, aliases] of Object.entries(DEPARTMENT_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_DEPARTMENT[normalize(alias)] = department
  }
}

export function matchDepartmentToSubtasks(
  departmentName: string
): PredefinedSubtask[] {
  if (!departmentName) return []

  const input = normalize(departmentName)
  if (!input) return []

  // Exact department key
  if (DEPARTMENT_SUBTASKS[input]) {
    return DEPARTMENT_SUBTASKS[input]
  }

  // Exact alias match (whole string)
  if (ALIAS_TO_DEPARTMENT[input]) {
    return DEPARTMENT_SUBTASKS[ALIAS_TO_DEPARTMENT[input]]
  }

  const inputWords = input.split(' ')

  // Word-boundary alias match (e.g. "metal dept" -> "metal")
  for (const word of inputWords) {
    if (ALIAS_TO_DEPARTMENT[word]) {
      return DEPARTMENT_SUBTASKS[ALIAS_TO_DEPARTMENT[word]]
    }
  }

  // Multi-word phrase match (e.g. "stone mason team" -> "stone mason")
  for (let i = 0; i < inputWords.length - 1; i++) {
    const phrase = `${inputWords[i]} ${inputWords[i + 1]}`
    if (ALIAS_TO_DEPARTMENT[phrase]) {
      return DEPARTMENT_SUBTASKS[ALIAS_TO_DEPARTMENT[phrase]]
    }
  }

  // Fuzzy fallback for typos/misspellings
  let bestDepartment: string | null = null
  let bestScore = 0

  for (const [department, aliases] of Object.entries(DEPARTMENT_ALIASES)) {
    for (const alias of aliases) {
      const normalizedAlias = normalize(alias)

      // Skip fuzzy scoring for short aliases; they're only matched exactly
      // (handled above) to avoid false positives from tiny edit distances.
      if (normalizedAlias.length < MIN_FUZZY_ALIAS_LENGTH) {
        continue
      }

      // Compare entire sentence
      let score = similarity(input, normalizedAlias)

      // Compare each individual word
      for (const word of inputWords) {
        score = Math.max(score, similarity(word, normalizedAlias))
      }

      // Compare every 2-word phrase (helps "metal dept")
      for (let i = 0; i < inputWords.length - 1; i++) {
        const phrase = `${inputWords[i]} ${inputWords[i + 1]}`
        score = Math.max(score, similarity(phrase, normalizedAlias))
      }

      if (score > bestScore) {
        bestScore = score
        bestDepartment = department
      }
    }
  }

  // Require at least 90% confidence
  if (bestDepartment && bestScore >= FUZZY_MATCH_THRESHOLD) {
    return DEPARTMENT_SUBTASKS[bestDepartment]
  }

  return []
}