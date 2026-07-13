import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import BottomNav from "@/components/BottomNav";
import EntryPage from "@/pages/EntryPage";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import LocationPage from "@/pages/LocationPage";
import HomePage from "@/pages/HomePage";
import SalonDetailPage from "@/pages/SalonDetailPage";
import BookingPage from "@/pages/BookingPage";
import BookingSummaryPage from "@/pages/BookingSummaryPage";
import ConfirmationPage from "@/pages/ConfirmationPage";
import BookingsPage from "@/pages/BookingsPage";
import ProfilePage from "@/pages/ProfilePage";
import NotificationsPage from "@/pages/NotificationsPage";
import RegisterSalonPage from "@/pages/RegisterSalonPage";
import ProfileSetupPage from "@/pages/ProfileSetupPage";
import SignUpPage from "@/pages/SignUpPage";
import NotFound from "@/pages/NotFound";
import TermsPage from "@/pages/TermsPage";

const queryClient = new QueryClient();

import { FavoritesProvider } from "@/contexts/FavoritesContext";

import ScrollToTop from "@/components/ScrollToTop";
import { CustomerNotificationListener, primeAudioContext } from "@/components/CustomerNotificationListener";

const App = () => (
  <div onClick={primeAudioContext} onTouchStart={primeAudioContext}>
  <ThemeProvider>
    <FavoritesProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <CustomerNotificationListener />
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<EntryPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/location" element={<LocationPage />} />
              <Route path="/profile-setup" element={<ProfileSetupPage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/salon/:id" element={<SalonDetailPage />} />
              <Route path="/booking/:id" element={<BookingPage />} />
              <Route path="/summary/:id" element={<BookingSummaryPage />} />
              <Route path="/confirmation/:id" element={<ConfirmationPage />} />
              <Route path="/bookings" element={<BookingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/register-salon" element={<RegisterSalonPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <BottomNav />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </FavoritesProvider>
  </ThemeProvider>
  </div>
);

export default App;
