import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import BackButton from "@/components/BackButton";
import Logo from "@/components/Logo";

const RegisterSalonPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    salonName: "",
    address: "",
    message: "",
  });

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <CheckCircle className="h-16 w-16 text-primary" />
          <h2 className="font-display text-2xl font-bold text-foreground">
            Registration Submitted!
          </h2>
          <p className="text-sm text-muted-foreground">
            We'll review your application and get in touch within 24 hours.
          </p>
        </motion.div>
      </div>
    );
  }

  const fields = [
    { key: "name", label: "Your Name", type: "text", placeholder: "John Doe" },
    { key: "phone", label: "Phone Number", type: "tel", placeholder: "+91 98765 43210" },
    { key: "email", label: "Email", type: "email", placeholder: "john@example.com" },
    { key: "salonName", label: "Salon Name", type: "text", placeholder: "My Salon" },
    { key: "address", label: "Salon Address", type: "text", placeholder: "Full address" },
  ];

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-md px-4 py-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <h2 className="font-display text-base font-semibold text-foreground">
            Register Your Salon
          </h2>
        </div>
        <Logo size="sm" showText={false} />
      </div>

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="mx-auto max-w-lg px-4 py-6"
      >
        <div className="flex flex-col gap-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {f.label}
              </label>
              <input
                type={f.type}
                value={(form as any)[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                placeholder={f.placeholder}
                required
                className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Message (optional)
            </label>
            <textarea
              value={form.message}
              onChange={(e) => update("message", e.target.value)}
              placeholder="Tell us about your salon..."
              rows={3}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary resize-none"
            />
          </div>
        </div>

        <button
          type="submit"
          className="mt-6 h-14 w-full rounded-2xl bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
        >
          Submit Registration
        </button>
      </motion.form>
    </div>
  );
};

export default RegisterSalonPage;
