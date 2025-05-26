import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Motor database (same as in RocketPy service)
const MOTOR_DATABASE = {
  "mini-motor": {
    "name": "A8-3", "manufacturer": "Estes", "type": "solid",
    "impulseClass": "A", "totalImpulse": 2.5, "avgThrust": 1.5,
    "burnTime": 1.8, "dimensions": {"diameter": 13, "length": 100},
    "weight": {"propellant": 0.008, "total": 0.015}, "isp": 150
  },
  "default-motor": {
    "name": "F32-6", "manufacturer": "Generic", "type": "solid",
    "impulseClass": "F", "totalImpulse": 80, "avgThrust": 32,
    "burnTime": 2.5, "dimensions": {"diameter": 29, "length": 124},
    "weight": {"propellant": 0.040, "total": 0.070}, "isp": 200
  },
  "high-power": {
    "name": "H180-7", "manufacturer": "Generic", "type": "solid",
    "impulseClass": "H", "totalImpulse": 320, "avgThrust": 100,
    "burnTime": 3.2, "dimensions": {"diameter": 38, "length": 150},
    "weight": {"propellant": 0.090, "total": 0.150}, "isp": 220
  },
  "super-power": {
    "name": "I200-8", "manufacturer": "Generic", "type": "solid",
    "impulseClass": "I", "totalImpulse": 800, "avgThrust": 200,
    "burnTime": 4.0, "dimensions": {"diameter": 54, "length": 200},
    "weight": {"propellant": 0.200, "total": 0.300}, "isp": 240
  },
  "small-liquid": {
    "name": "Liquid-500N", "manufacturer": "Custom", "type": "liquid",
    "impulseClass": "M", "totalImpulse": 15000, "avgThrust": 500,
    "burnTime": 30, "dimensions": {"diameter": 75, "length": 300},
    "weight": {"propellant": 1.5, "total": 2.3}, "isp": 300
  },
  "medium-liquid": {
    "name": "Liquid-2000N", "manufacturer": "Custom", "type": "liquid",
    "impulseClass": "O", "totalImpulse": 90000, "avgThrust": 2000,
    "burnTime": 45, "dimensions": {"diameter": 100, "length": 400},
    "weight": {"propellant": 6.5, "total": 8.5}, "isp": 320
  },
  "large-liquid": {
    "name": "Liquid-8000N", "manufacturer": "Custom", "type": "liquid",
    "impulseClass": "P", "totalImpulse": 120000, "avgThrust": 8000,
    "burnTime": 15, "dimensions": {"diameter": 150, "length": 500},
    "weight": {"propellant": 8.0, "total": 11.0}, "isp": 340
  },
  "hybrid-engine": {
    "name": "Hybrid-1200N", "manufacturer": "Custom", "type": "hybrid",
    "impulseClass": "N", "totalImpulse": 24000, "avgThrust": 1200,
    "burnTime": 20, "dimensions": {"diameter": 90, "length": 350},
    "weight": {"propellant": 4.5, "total": 5.7}, "isp": 280
  }
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const motorType = searchParams.get('motor_type');
    const manufacturer = searchParams.get('manufacturer');
    const impulseClass = searchParams.get('impulse_class');
    
    const motors = [];
    
    for (const [motorId, spec] of Object.entries(MOTOR_DATABASE)) {
      // Apply filters
      if (motorType && spec.type !== motorType) {
        continue;
      }
      if (manufacturer && spec.manufacturer.toLowerCase() !== manufacturer.toLowerCase()) {
        continue;
      }
      if (impulseClass && spec.impulseClass !== impulseClass) {
        continue;
      }
      
      const motorSpec = {
        id: motorId,
        name: spec.name,
        manufacturer: spec.manufacturer,
        type: spec.type,
        impulseClass: spec.impulseClass,
        totalImpulse: spec.totalImpulse,
        avgThrust: spec.avgThrust,
        burnTime: spec.burnTime,
        dimensions: spec.dimensions,
        weight: spec.weight
      };
      
      motors.push(motorSpec);
    }
    
    return NextResponse.json({ motors });
    
  } catch (error) {
    console.error("Motors API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch motors" }, 
      { status: 500 }
    );
  }
} 