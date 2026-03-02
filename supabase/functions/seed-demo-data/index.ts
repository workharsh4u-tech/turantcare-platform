import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: string[] = [];

    // Helper to create user
    async function createUser(email: string, password: string, meta: Record<string, string>) {
      const { data, error } = await supabase.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: meta,
      });
      if (error) throw new Error(`User ${email}: ${error.message}`);
      results.push(`Created user: ${email}`);
      return data.user;
    }

    // 1. Two patients
    const patient1 = await createUser("patient1@turantcare.demo", "demo1234", {
      role: "patient", full_name: "Aarav Sharma",
    });
    const patient2 = await createUser("patient2@turantcare.demo", "demo1234", {
      role: "patient", full_name: "Priya Patel",
    });

    // Set patient details & PINs
    for (const [userId, details] of [
      [patient1.id, { name: "Aarav Sharma", age: 32, gender: "Male", blood_group: "B+", diabetes: false, allergies: "Peanuts", chronic_conditions: "None", emergency_contact: "+91-9876543210" }],
      [patient2.id, { name: "Priya Patel", age: 28, gender: "Female", blood_group: "O+", diabetes: true, allergies: "None", chronic_conditions: "Type 2 Diabetes", emergency_contact: "+91-9988776655" }],
    ] as const) {
      // Update patient record
      const { error } = await supabase.from("patients").update(details).eq("user_id", userId);
      if (error) results.push(`Patient update error: ${error.message}`);
    }

    // Set PINs (using raw SQL via rpc won't work here, so update directly with bcrypt)
    // We'll use a raw query approach - set pin via the function by impersonating
    // Actually, let's just set pin_hash directly using pgcrypto
    const { error: pin1Err } = await supabase.rpc("set_pin_admin", { p_user_id: patient1.id, p_pin: "1234" }).maybeSingle();
    const { error: pin2Err } = await supabase.rpc("set_pin_admin", { p_user_id: patient2.id, p_pin: "5678" }).maybeSingle();
    
    // If the admin pin function doesn't exist, update directly
    if (pin1Err || pin2Err) {
      // Direct SQL update for pins using service role
      await supabase.from("patients").update({ pin_hash: "NEEDS_SETUP" }).eq("user_id", patient1.id);
      await supabase.from("patients").update({ pin_hash: "NEEDS_SETUP" }).eq("user_id", patient2.id);
      results.push("PINs need to be set by patients on first login (set_pin_admin not available)");
    } else {
      results.push("PINs set: Patient1=1234, Patient2=5678");
    }

    // 2. Diagnostic Center
    const dc = await createUser("diagnostics@turantcare.demo", "demo1234", {
      role: "diagnostic_center", full_name: "QuickLab Diagnostics",
    });
    await supabase.from("diagnostic_centers").update({
      name: "QuickLab Diagnostics",
      address: "42 MG Road, Bengaluru",
      phone: "+91-8800112233",
    }).eq("user_id", dc.id);
    results.push("Updated diagnostic center details");

    // 3. Self-clinic doctor
    const selfDoc = await createUser("doctor@turantcare.demo", "demo1234", {
      role: "doctor", full_name: "Dr. Vikram Mehta",
    });
    await supabase.from("doctors").update({
      name: "Dr. Vikram Mehta",
      specialization: "General Medicine",
      phone: "+91-9000011111",
      role_type: "doctor_self_clinic",
    }).eq("user_id", selfDoc.id);
    results.push("Updated self-clinic doctor details");

    // 4. Hospital Admin
    const hospitalAdmin = await createUser("hospital@turantcare.demo", "demo1234", {
      role: "hospital_admin", full_name: "Dr. Sunita Reddy", hospital_name: "City Care Hospital",
    });
    // Update hospital details
    await supabase.from("hospitals").update({
      address: "100 Jubilee Hills, Hyderabad",
    }).eq("admin_user_id", hospitalAdmin.id);
    // Update admin doctor details
    await supabase.from("doctors").update({
      name: "Dr. Sunita Reddy",
      specialization: "Hospital Administration",
      phone: "+91-9111122222",
    }).eq("user_id", hospitalAdmin.id);
    results.push("Updated hospital admin details");

    // Get hospital ID
    const { data: hospital } = await supabase.from("hospitals").select("id").eq("admin_user_id", hospitalAdmin.id).single();

    // 5. Two hospital doctors
    const hDoc1 = await createUser("hdoctor1@turantcare.demo", "demo1234", {
      role: "doctor", full_name: "Dr. Rahul Kapoor",
    });
    await supabase.from("doctors").update({
      name: "Dr. Rahul Kapoor",
      specialization: "Cardiology",
      hospital_id: hospital?.id,
      role_type: "hospital_doctor",
    }).eq("user_id", hDoc1.id);

    const hDoc2 = await createUser("hdoctor2@turantcare.demo", "demo1234", {
      role: "doctor", full_name: "Dr. Ananya Singh",
    });
    await supabase.from("doctors").update({
      name: "Dr. Ananya Singh",
      specialization: "Dermatology",
      hospital_id: hospital?.id,
      role_type: "hospital_doctor",
    }).eq("user_id", hDoc2.id);
    results.push("Created 2 hospital doctors");

    // Get patient card numbers for reference
    const { data: patients } = await supabase.from("patients").select("card_number, name").in("user_id", [patient1.id, patient2.id]);

    return new Response(JSON.stringify({
      success: true,
      results,
      credentials: {
        patients: [
          { email: "patient1@turantcare.demo", password: "demo1234", pin: "1234 (set on first login)", name: "Aarav Sharma", card: patients?.[0]?.card_number },
          { email: "patient2@turantcare.demo", password: "demo1234", pin: "5678 (set on first login)", name: "Priya Patel", card: patients?.[1]?.card_number },
        ],
        diagnostic_center: { email: "diagnostics@turantcare.demo", password: "demo1234", name: "QuickLab Diagnostics" },
        self_clinic_doctor: { email: "doctor@turantcare.demo", password: "demo1234", name: "Dr. Vikram Mehta" },
        hospital_admin: { email: "hospital@turantcare.demo", password: "demo1234", name: "Dr. Sunita Reddy", hospital: "City Care Hospital" },
        hospital_doctors: [
          { email: "hdoctor1@turantcare.demo", password: "demo1234", name: "Dr. Rahul Kapoor", specialization: "Cardiology" },
          { email: "hdoctor2@turantcare.demo", password: "demo1234", name: "Dr. Ananya Singh", specialization: "Dermatology" },
        ],
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Seed error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
