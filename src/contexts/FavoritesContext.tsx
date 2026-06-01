import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface FavoritesContextType {
  favorites: string[];
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        fetchFavorites(user.id);
      }
    });

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUserId(session.user.id);
          fetchFavorites(session.user.id);
        } else {
          setUserId(null);
          setFavorites([]);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchFavorites = async (uid: string) => {
    const { data } = await supabase
      .from("customer_favorites")
      .select("salon_id")
      .eq("customer_id", uid);
    if (data) {
      setFavorites(data.map((f: any) => f.salon_id));
    }
  };

  const toggleFavorite = async (salonId: string) => {
    if (!userId) {
      toast.error("Please login to save favorite salons");
      return; 
    }
    
    // Optimistic UI update
    const isFav = favorites.includes(salonId);
    setFavorites((prev) =>
      isFav ? prev.filter((id) => id !== salonId) : [...prev, salonId]
    );

    // Sync with DB
    if (isFav) {
      await supabase
        .from("customer_favorites")
        .delete()
        .match({ customer_id: userId, salon_id: salonId });
    } else {
      await supabase
        .from("customer_favorites")
        .insert({ customer_id: userId, salon_id: salonId });
    }
  };

  const isFavorite = (id: string) => favorites.includes(id);

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite, isFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
};
