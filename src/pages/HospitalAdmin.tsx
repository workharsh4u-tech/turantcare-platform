import { useState, useEffect } from "react";
import { getHospitalByAdmin, getHospitalDoctors, createHospitalDoctor } from "@/services/hospital.service";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, UserPlus, Users } from "lucide-react";

export default function HospitalAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [hospital, setHospital] = useState<Record<string, any> | null>(null);
  const [doctors, setDoctors] = useState<Record<string, any>[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", specialization: "", password: "" });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
  try {
    const h = await getHospitalByAdmin(user!.id);
    if (h) {
      setHospital(h);
      const d = await getHospitalDoctors(h.id);
      setDoctors(d);
    }
  } catch (err) {
    console.error("Hospital data load failed:", err);
    toast({
      title: "Error",
      description: "Unable to load hospital data",
      variant: "destructive",
    });
  }
};

  const addDoctor = async () => {
    if (!form.name || !form.email || !form.password) return;
    setAdding(true);
    try {
      // Create user account for the doctor via edge function
      await createHospitalDoctor({
      email: form.email,
      password: form.password,
      fullName: form.name,
      specialization: form.specialization,
      hospitalId: hospital.id,
      });
      toast({ title: "Doctor account created!" });
      setShowAdd(false);
      setForm({ name: "", email: "", specialization: "", password: "" });
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setAdding(false);
  };

  if (!hospital) return <DashboardLayout title="Loading..."><div /></DashboardLayout>;

  return (
    <DashboardLayout title="Hospital Admin" subtitle={hospital.name}>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Doctors ({doctors.length})
            </h3>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <UserPlus className="w-4 h-4 mr-1.5" /> Add Doctor
            </Button>
          </div>
          <div className="space-y-2">
            {doctors.map((d) => (
              <div key={d.id} className="p-3 rounded-lg bg-muted flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.specialization || "General"} • {d.email}</p>
                </div>
                <span className="text-xs bg-accent px-2 py-1 rounded">{d.doctor_code}</span>
              </div>
            ))}
            {doctors.length === 0 && <p className="text-sm text-muted-foreground">No doctors added yet.</p>}
          </div>
        </div>

        {showAdd && (
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <h3 className="font-display font-semibold text-lg mb-4">Add New Doctor</h3>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Specialization</Label><Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} /></div>
              <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div className="flex gap-2">
                <Button onClick={addDoctor} disabled={adding} className="flex-1">{adding ? "Creating..." : "Create Account"}</Button>
                <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <h3 className="font-display font-semibold text-lg flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-primary" /> Hospital Info
          </h3>
          <p className="text-sm"><span className="text-muted-foreground">Name:</span> {hospital.name}</p>
          <p className="text-sm"><span className="text-muted-foreground">Address:</span> {hospital.address || "—"}</p>
          <p className="text-sm"><span className="text-muted-foreground">Created:</span> {new Date(hospital.created_at).toLocaleDateString()}</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
