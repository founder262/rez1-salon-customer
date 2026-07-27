import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  RefreshCcw,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Logo from "@/components/Logo";

type Tab = "terms" | "privacy";

interface Section {
  icon: React.ElementType;
  title: string;
  content: React.ReactNode;
}

const TermsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { tab?: Tab; section?: number } | null;

  const [activeTab, setActiveTab] = useState<Tab>(locationState?.tab || "terms");
  const [expandedSection, setExpandedSection] = useState<number | null>(
    locationState?.section ?? 0
  );

  // If navigated with a state, clear it after reading to avoid stale state on back-navigation
  useEffect(() => {
    if (locationState?.tab) setActiveTab(locationState.tab);
    if (locationState?.section !== undefined) setExpandedSection(locationState.section);
  }, []);

  const toggleSection = (idx: number) =>
    setExpandedSection(expandedSection === idx ? null : idx);

  const termsSections: Section[] = [
    {
      icon: FileText,
      title: "1. Acceptance of Terms",
      content: (
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>
            By accessing or using the Rez1 platform ("Service"), you agree to be bound by these Terms &amp; Conditions. If you do not agree, please discontinue use immediately.
          </p>
          <p>
            These terms apply to all users, including customers, salon owners, and visitors to the platform.
          </p>
        </div>
      ),
    },
    {
      icon: ShieldCheck,
      title: "2. User Accounts &amp; Eligibility",
      content: (
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>You must be at least 18 years old to create an account on Rez1. By registering, you confirm that:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>All information you provide is accurate and up to date.</li>
            <li>You will keep your login credentials confidential.</li>
            <li>You are responsible for all activity under your account.</li>
          </ul>
        </div>
      ),
    },
    {
      icon: RefreshCcw,
      title: "3. Refund &amp; Cancellation Policy",
      content: (
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p className="font-semibold text-foreground">
            Please read our refund policy carefully before making a booking.
          </p>

          {/* Timeline Indicator */}
          <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
            {[
              {
                time: "24+ hours before",
                label: "Full Refund",
                desc: "Cancel at least 24 hours before your appointment to receive a 100% refund to your original payment method.",
                color: "bg-green-500",
                textColor: "text-green-600 dark:text-green-400",
              },
              {
                time: "6–24 hours before",
                label: "50% Refund",
                desc: "Cancellations made between 6 and 24 hours before the appointment are eligible for a 50% refund.",
                color: "bg-amber-500",
                textColor: "text-amber-600 dark:text-amber-400",
              },
              {
                time: "Less than 6 hours",
                label: "No Refund",
                desc: "Cancellations within 6 hours of the scheduled appointment are non-refundable.",
                color: "bg-red-500",
                textColor: "text-red-600 dark:text-red-400",
              },
            ].map((item) => (
              <div key={item.time} className="flex items-start gap-3">
                <div className="flex flex-col items-center shrink-0 pt-1">
                  <div className={`h-3 w-3 rounded-full ${item.color}`} />
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wider ${item.textColor}`}>
                    {item.time} → {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2">
            <p className="flex items-center gap-2 font-semibold text-foreground text-xs uppercase tracking-wider">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Refund Processing Time
            </p>
            <p>
              Approved refunds are processed within <strong className="text-foreground">5–7 business days</strong> to your original payment method (credit/debit card or UPI). The exact credit time may vary depending on your bank or payment provider.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
            <p className="flex items-center gap-2 font-semibold text-foreground text-xs uppercase tracking-wider">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              Special Circumstances
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>If a salon cancels your appointment, you are entitled to a <strong className="text-foreground">100% refund</strong> regardless of timing.</li>
              <li>Refunds for technical payment failures are processed automatically within 3 business days.</li>
              <li>Reward points used in a booking are refunded back to your Rez1 account upon eligible cancellation.</li>
            </ul>
          </div>

          <p className="text-xs">
            To request a refund, navigate to{" "}
            <strong className="text-foreground">My Bookings</strong> → select your booking → tap{" "}
            <strong className="text-foreground">Cancel Booking</strong>. For disputes, contact us at{" "}
            <a href="mailto:contact@rez1.in" className="text-primary font-semibold underline-offset-2 hover:underline">
              contact@rez1.in
            </a>.
          </p>
        </div>
      ),
    },
    {
      icon: Clock,
      title: "4. Booking &amp; Appointment Rules",
      content: (
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Bookings are confirmed only after successful payment.</li>
            <li>You must arrive on time. Late arrivals may result in a shortened service or cancellation at the salon's discretion.</li>
            <li>Rez1 is a booking intermediary and is not responsible for the quality of services provided by salons.</li>
            <li>Any disputes regarding service quality must be raised directly with the salon or via our Help Center.</li>
          </ul>
        </div>
      ),
    },
    {
      icon: AlertCircle,
      title: "5. Prohibited Activities",
      content: (
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>You agree not to:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Use the platform for any unlawful or fraudulent purpose.</li>
            <li>Attempt to manipulate reviews, ratings, or reward points.</li>
            <li>Impersonate another person or entity.</li>
            <li>Engage in any activity that disrupts or interferes with the Service.</li>
          </ul>
        </div>
      ),
    },
    {
      icon: ShieldCheck,
      title: "6. Limitation of Liability",
      content: (
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>
            To the maximum extent permitted by law, Rez1 shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service, including but not limited to loss of revenue, data, or goodwill.
          </p>
          <p>
            Rez1's total liability for any claim arising from these terms shall not exceed the amount paid by you for the specific booking in question.
          </p>
        </div>
      ),
    },
    {
      icon: FileText,
      title: "7. Changes to Terms",
      content: (
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>
            Rez1 reserves the right to modify these Terms &amp; Conditions at any time. We will notify users of material changes via the app or email. Continued use of the Service after changes constitutes acceptance of the revised terms.
          </p>
          <p className="text-xs">Last updated: July 2026</p>
        </div>
      ),
    },
  ];

  const privacySections: Section[] = [
    {
      icon: ShieldCheck,
      title: "1. Information We Collect",
      content: (
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>We collect the following types of information:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong className="text-foreground">Personal Information:</strong> Name, email address, phone number, and profile photo.</li>
            <li><strong className="text-foreground">Booking Data:</strong> Appointment history, salon preferences, and payment records.</li>
            <li><strong className="text-foreground">Location Data:</strong> City/area selected to provide relevant salon recommendations.</li>
            <li><strong className="text-foreground">Device Data:</strong> Device type, OS, browser, and IP address for security and analytics.</li>
          </ul>
        </div>
      ),
    },
    {
      icon: FileText,
      title: "2. How We Use Your Information",
      content: (
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>To process and manage your bookings.</li>
            <li>To send booking confirmations, reminders, and notifications.</li>
            <li>To personalize your salon discovery experience.</li>
            <li>To manage your reward points and loyalty benefits.</li>
            <li>To improve our platform through analytics and feedback.</li>
            <li>To comply with legal obligations.</li>
          </ul>
        </div>
      ),
    },
    {
      icon: ShieldCheck,
      title: "3. Data Sharing &amp; Disclosure",
      content: (
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>We do <strong className="text-foreground">not</strong> sell your personal data. We may share data with:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong className="text-foreground">Salons:</strong> Your name and contact details are shared with the salon you book with.</li>
            <li><strong className="text-foreground">Payment Processors:</strong> Razorpay and other gateways for secure payment processing.</li>
            <li><strong className="text-foreground">Legal Authorities:</strong> When required by law or to protect Rez1's rights.</li>
          </ul>
        </div>
      ),
    },
    {
      icon: Clock,
      title: "4. Data Retention",
      content: (
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>
            We retain your personal data for as long as your account is active or as needed to provide the Service. You may request deletion of your account and associated data by contacting us at{" "}
            <a href="mailto:contact@rez1.in" className="text-primary font-semibold">contact@rez1.in</a>.
          </p>
          <p>Some data may be retained for legal or accounting purposes for up to 7 years.</p>
        </div>
      ),
    },
    {
      icon: ShieldCheck,
      title: "5. Security",
      content: (
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>
            We use industry-standard security measures including encryption, secure connections (HTTPS/TLS), and access controls to protect your data. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
          </p>
        </div>
      ),
    },
    {
      icon: FileText,
      title: "6. Your Rights",
      content: (
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>You have the right to:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Access and review your personal data.</li>
            <li>Request correction of inaccurate information.</li>
            <li>Request deletion of your account and data.</li>
            <li>Opt out of marketing communications at any time.</li>
          </ul>
          <p>
            To exercise these rights, contact us at{" "}
            <a href="mailto:contact@rez1.in" className="text-primary font-semibold">contact@rez1.in</a>.
          </p>
        </div>
      ),
    },
    {
      icon: AlertCircle,
      title: "7. Cookies &amp; Tracking",
      content: (
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>
            Rez1 uses essential cookies and local storage to maintain your session and preferences (e.g., dark/light theme, location). We do not use third-party advertising cookies.
          </p>
        </div>
      ),
    },
  ];

  const sections = activeTab === "terms" ? termsSections : privacySections;

  const containerVariants = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 30, staggerChildren: 0.06 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-[100dvh] bg-background safe-bottom overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-md px-4 sm:px-6 py-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-bold text-primary hover:opacity-80 transition-opacity"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h2 className="font-display text-lg font-bold text-foreground">
          {activeTab === "terms" ? "Terms & Conditions" : "Privacy Policy"}
        </h2>
        <Logo size="sm" showText={false} />
      </div>

      <div className="mx-auto max-w-lg px-4 sm:px-6 pt-4 pb-24">
        {/* Tab Switcher */}
        <div className="mb-6 flex rounded-2xl border border-border bg-muted/30 p-1">
          {(["terms", "privacy"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setExpandedSection(0);
              }}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "terms" ? "Terms & Conditions" : "Privacy Policy"}
            </button>
          ))}
        </div>

        {/* Intro Banner */}
        <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
          {activeTab === "terms" ? (
            <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-bold text-foreground">
              {activeTab === "terms"
                ? "Rez1 Terms & Conditions"
                : "Rez1 Privacy Policy"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {activeTab === "terms"
                ? "By using Rez1, you agree to these terms. Please read them carefully, especially our refund and cancellation policy."
                : "We respect your privacy. This policy explains how we collect, use, and protect your personal information."}
            </p>
            <p className="mt-1.5 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
              Effective Date: July 2026
            </p>
          </div>
        </div>

        {/* Accordion Sections */}
        <motion.div
          key={activeTab}
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          {sections.map((section, idx) => {
            const Icon = section.icon;
            const isOpen = expandedSection === idx;
            const isRefund = section.title.includes("Refund");

            return (
              <motion.div
                key={idx}
                variants={itemVariants}
                className={`overflow-hidden rounded-2xl border transition-all ${
                  isRefund
                    ? "border-primary/40 bg-primary/5 shadow-sm"
                    : "border-border bg-card"
                }`}
              >
                <button
                  onClick={() => toggleSection(idx)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      isOpen
                        ? "bg-primary text-primary-foreground"
                        : isRefund
                        ? "bg-primary/15 text-primary"
                        : "bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span
                    className={`flex-1 text-sm font-semibold ${
                      isRefund ? "text-primary" : "text-foreground"
                    }`}
                    dangerouslySetInnerHTML={{ __html: section.title }}
                  />
                  {isRefund && (
                    <span className="mr-2 rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                      Important
                    </span>
                  )}
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-border/50 px-5 pb-5 pt-4"
                  >
                    {section.content}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {/* Contact Footer */}
        <div className="mt-8 rounded-2xl border border-border bg-muted/30 p-5 text-center">
          <p className="text-sm font-bold text-foreground mb-1">Have questions?</p>
          <p className="text-xs text-muted-foreground mb-3">
            Our support team is happy to help with any questions about our policies.
          </p>
          <a
            href="mailto:contact@rez1.in"
            className="inline-block rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition-all active:scale-95 mb-3"
          >
            Contact Us
          </a>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              📧{" "}
              <a
                href="mailto:contact@rez1.in"
                className="text-primary font-semibold underline-offset-2 hover:underline"
              >
                contact@rez1.in
              </a>
            </p>
            <p className="text-xs text-muted-foreground">
              📞{" "}
              <a
                href="tel:7338869230"
                className="text-primary font-semibold underline-offset-2 hover:underline"
              >
                7338869230
              </a>
            </p>
          </div>
        </div>
        {/* Version note */}
        <p className="mt-6 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground opacity-30">
          Rez1 Salon Panel · Legal Documents · v2.5.0
        </p>
      </div>
    </div>
  );
};

export default TermsPage;
