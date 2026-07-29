import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";

interface LegalConsentProps {
  onConsentChange: (isConsented: boolean) => void;
}

export const LegalConsent = ({ onConsentChange }: LegalConsentProps) => {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [activeModal, setActiveModal] = useState<"terms" | "privacy" | null>(null);

  const handleTermsChange = () => {
    const newTerms = !termsAccepted;
    setTermsAccepted(newTerms);
    onConsentChange(newTerms && privacyAccepted);
  };

  const handlePrivacyChange = () => {
    const newPrivacy = !privacyAccepted;
    setPrivacyAccepted(newPrivacy);
    onConsentChange(termsAccepted && newPrivacy);
  };

  return (
    <>
      <div className="flex flex-col gap-4 py-2">
        <label className="flex items-start gap-3 cursor-pointer group">
          <div 
            onClick={(e) => {
              e.preventDefault();
              handleTermsChange();
            }}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${termsAccepted ? 'bg-[#B8860B] border-[#B8860B]' : 'border-[#444] group-hover:border-[#B8860B]'} transition-colors`}
          >
            {termsAccepted && <Check className="h-3.5 w-3.5 text-black" />}
          </div>
          <span className="text-xs text-[#888] leading-relaxed">
            I agree to REZ1's <button type="button" onClick={(e) => { e.preventDefault(); setActiveModal('terms'); }} className="text-[#B8860B] hover:underline font-medium">Terms & Conditions</button>.
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer group">
          <div 
            onClick={(e) => {
               e.preventDefault();
               handlePrivacyChange();
            }}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${privacyAccepted ? 'bg-[#B8860B] border-[#B8860B]' : 'border-[#444] group-hover:border-[#B8860B]'} transition-colors`}
          >
            {privacyAccepted && <Check className="h-3.5 w-3.5 text-black" />}
          </div>
          <span className="text-xs text-[#888] leading-relaxed">
            I consent to the collection and use of my personal information in accordance with the <button type="button" onClick={(e) => { e.preventDefault(); setActiveModal('privacy'); }} className="text-[#B8860B] hover:underline font-medium">Privacy Policy</button>.
          </span>
        </label>
      </div>

      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] flex flex-col bg-[#050505]"
          >
            <div className="flex items-center justify-between border-b border-[#1A1A1F] px-6 py-4 bg-[#0A0A0F] sticky top-0 z-10 shadow-sm">
              <h2 className="text-lg font-bold text-white">
                {activeModal === "terms" ? "Terms & Conditions" : "Privacy Policy"}
              </h2>
              <button onClick={() => setActiveModal(null)} className="rounded-full bg-[#1A1A1F] p-2 text-white hover:bg-[#222] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 py-8 pb-32 text-sm text-[#888] leading-relaxed">
              {activeModal === "terms" ? (
                <div className="space-y-6">
                  
                  <p>Welcome to REZ1. By using our platform to book salon services, you agree to the following terms and conditions.</p>

                  <div>
                    <h3 className="font-bold text-white mb-2">1. PLATFORM OVERVIEW</h3>
                    <p>REZ1 is a digital platform that connects users with salons for booking appointments.</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">2. USER ELIGIBILITY</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>You must provide accurate information</li>
                      <li>You must be at least 18 years old or use under supervision</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">3. BOOKINGS</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>All bookings are subject to salon availability</li>
                      <li>Once confirmed, you are expected to arrive on time</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">4. PAYMENTS</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Payments can be made online or at the salon (if allowed)</li>
                      <li>Online payments are processed securely via third-party providers</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">5. CANCELLATIONS & REFUNDS</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Users may cancel a booking up to 20 minutes before the scheduled appointment time to receive a full refund.</li>
                      <li>If a booking is cancelled within 20 minutes of the scheduled time, only 50% of the booking amount will be refunded.</li>
                      <li>No refunds will be provided for missed appointments or no-shows.</li>
                      <li>Refunds (if applicable) will be processed within a reasonable timeframe through the original payment method.</li>
                      <li>Cancellation policies may be subject to change based on platform updates.</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">6. USER RESPONSIBILITIES</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Arrive on time for your booking</li>
                      <li>Provide correct contact details</li>
                      <li>Treat salon staff respectfully</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">7. NO-SHOW POLICY</h3>
                    <p>Repeated no-shows may lead to account restrictions</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">8. LIABILITY</h3>
                    <p>REZ1 is a platform and is not responsible for service quality or disputes between users and salons.</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">9. DATA PRIVACY</h3>
                    <p>Your data is handled as per our Privacy Policy.</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">10. MODIFICATIONS</h3>
                    <p>REZ1 may update these terms at any time.</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">11. CONTACT</h3>
                    <p>Email: contact@rez1.in<br/>Website: www.rez1.in</p>
                  </div>

                  <p className="font-bold text-[#B8860B] pt-4">By using REZ1, you agree to these terms.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <p>REZ1 (“we”, “our”, or “us”) respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you use the REZ1 platform.</p>
                  <p>By using REZ1, you agree to the terms of this Privacy Policy.</p>

                  <div>
                    <h3 className="font-bold text-white mb-2">1. INFORMATION WE COLLECT</h3>
                    
                    <h4 className="font-semibold text-white/80 mt-3 mb-1">a) Personal Information</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Name</li>
                      <li>Phone number</li>
                      <li>Email address (optional)</li>
                    </ul>

                    <h4 className="font-semibold text-white/80 mt-3 mb-1">b) Location Information</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Current location (to show nearby salons)</li>
                      <li>City or manually selected location</li>
                    </ul>

                    <h4 className="font-semibold text-white/80 mt-3 mb-1">c) Booking Information</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Selected salon</li>
                      <li>Services booked</li>
                      <li>Date and time of appointment</li>
                    </ul>

                    <h4 className="font-semibold text-white/80 mt-3 mb-1">d) Usage Data</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>App interactions</li>
                      <li>Device information</li>
                      <li>Log data</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">2. HOW WE USE YOUR INFORMATION</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Enable salon booking and scheduling</li>
                      <li>Share booking details with selected salons</li>
                      <li>Send booking confirmations and reminders</li>
                      <li>Improve app performance and user experience</li>
                      <li>Provide customer support</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">3. SHARING OF INFORMATION</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>With salon owners (only necessary booking details)</li>
                      <li>With third-party services (payments, hosting, analytics)</li>
                    </ul>
                    <p className="mt-2 text-white">We do NOT sell your personal data.</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">4. PAYMENT INFORMATION</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Payments are processed through secure third-party providers (e.g., PhonePe)</li>
                      <li>REZ1 does not store card or banking details</li>
                      <li>All financial data is handled securely by payment partners</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">5. LOCATION USAGE</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Location is used only to show nearby salons</li>
                      <li>You can disable location access and select your city manually</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">6. DATA SECURITY</h3>
                    <p className="mb-2">We implement security measures such as:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Secure authentication</li>
                      <li>Encrypted communication</li>
                      <li>Restricted data access</li>
                    </ul>
                    <p className="mt-2">However, no system is completely secure.</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">7. DATA RETENTION</h3>
                    <p>We retain your data only as long as necessary for service and legal compliance.</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">8. USER RIGHTS</h3>
                    <p className="mb-2">You can:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Access your data</li>
                      <li>Correct your data</li>
                      <li>Request account deletion</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">9. COOKIES & TRACKING</h3>
                    <p>Used to improve experience and analyze usage.</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">10. THIRD-PARTY SERVICES</h3>
                    <p>Used for payments, hosting, and analytics.</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">11. CHILDREN’S PRIVACY</h3>
                    <p>REZ1 is not intended for users under 18.</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">12. POLICY UPDATES</h3>
                    <p>We may update this policy periodically.</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-white mb-2">13. CONTACT</h3>
                    <p>Email: contact@rez1.in<br/>Website: www.rez1.in</p>
                  </div>

                  <p className="font-bold text-[#B8860B] pt-4">By using REZ1, you agree to this Privacy Policy.</p>
                </div>
              )}
            </div>
            
            <div className="border-t border-[#1A1A1F] p-6 bg-[#0A0A0F] sticky bottom-0 z-10">
              <button
                onClick={() => {
                  if (activeModal === 'terms') {
                    setTermsAccepted(true);
                    onConsentChange(true && privacyAccepted);
                  } else {
                    setPrivacyAccepted(true);
                    onConsentChange(termsAccepted && true);
                  }
                  setActiveModal(null);
                }}
                className="w-full rounded-xl bg-gradient-to-r from-[#B8860B] to-[#E8C97A] py-4 text-sm font-bold text-black shadow-lg transition-transform active:scale-[0.98]"
              >
                Accept & Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
