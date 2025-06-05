import { NextRequest, NextResponse } from "next/server";
import { getMotors, toLegacyFormat } from "@/lib/data/motors";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const motorType = searchParams.get('motor_type') as "solid" | "liquid" | "hybrid" | null;
    const manufacturer = searchParams.get('manufacturer');
    const impulseClass = searchParams.get('impulse_class');
    
    // Use centralized motor database with filters
    const motors = getMotors({
      type: motorType || undefined,
      manufacturer: manufacturer || undefined,
      impulseClass: impulseClass || undefined
    });
    
    // Convert to legacy format for backward compatibility
    const legacyMotors = motors.map(motor => ({
      id: motor.id,
      ...toLegacyFormat(motor)
    }));
    
    return NextResponse.json({ motors: legacyMotors });
    
  } catch (error) {
    console.error("Motors API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch motors" }, 
      { status: 500 }
    );
  }
} 