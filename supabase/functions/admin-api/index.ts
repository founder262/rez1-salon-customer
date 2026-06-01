// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, salonId, data, userId } = body;

    // ── Route to different admin operations ──
    switch (action) {
      case "add-rating":
        return handleAddRating(supabase, salonId, data);

      case "update-rating":
        return handleUpdateRating(supabase, salonId, data);

      case "get-salon-stats":
        return handleGetSalonStats(supabase, salonId);

      case "update-bookmark-offer":
        return handleBookmarkOfferUpdate(supabase, salonId, data);

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err: any) {
    console.error("admin-api edge function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Handler: Add a new review/rating for a salon ──
async function handleAddRating(
  supabase: any,
  salonId: string,
  data: {
    customerId: string;
    rating: number;
    title: string;
    review_text: string;
  }
) {
  const { customerId, rating, title, review_text } = data;

  if (!customerId || !rating || rating < 1 || rating > 5) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid rating data" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: newReview, error } = await supabase
    .from("reviews")
    .insert({
      salon_id: salonId,
      customer_id: customerId,
      rating,
      title: title || `${rating} Star Review`,
      review_text: review_text || "",
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── Update salon's average rating ──
  await updateSalonAverageRating(supabase, salonId);

  return new Response(
    JSON.stringify({ success: true, data: newReview }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Handler: Update existing review/rating ──
async function handleUpdateRating(
  supabase: any,
  salonId: string,
  data: { reviewId: string; rating: number; review_text: string }
) {
  const { reviewId, rating, review_text } = data;

  if (!rating || rating < 1 || rating > 5) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid rating data" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: updated, error } = await supabase
    .from("reviews")
    .update({ rating, review_text, updated_at: new Date().toISOString() })
    .eq("id", reviewId)
    .select()
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── Update salon's average rating ──
  await updateSalonAverageRating(supabase, salonId);

  return new Response(
    JSON.stringify({ success: true, data: updated }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Helper: Recalculate salon average rating ──
async function updateSalonAverageRating(supabase: any, salonId: string) {
  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating")
    .eq("salon_id", salonId);

  if (reviews && reviews.length > 0) {
    const avgRating = (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1);
    
    await supabase
      .from("salons")
      .update({ average_rating: parseFloat(avgRating) })
      .eq("id", salonId);
  }
}

// ── Handler: Get salon statistics ──
async function handleGetSalonStats(supabase: any, salonId: string) {
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("salon_id", salonId);

  const { data: reviews } = await supabase
    .from("reviews")
    .select("*")
    .eq("salon_id", salonId);

  const completedBookings = bookings?.filter((b: any) => b.status === "completed").length || 0;
  const totalEarnings = bookings?.reduce((sum: number, b: any) => {
    if (b.payment_status === "paid") return sum + (b.total_amount - (b.platform_fee || 0));
    return sum;
  }, 0) || 0;

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        total_bookings: bookings?.length || 0,
        completed_bookings: completedBookings,
        total_reviews: reviews?.length || 0,
        total_earnings: totalEarnings,
        average_rating: reviews && reviews.length > 0 
          ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1)
          : 0,
      },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Handler: Update bookmark offer ──
async function handleBookmarkOfferUpdate(
  supabase: any,
  salonId: string,
  data: any
) {
  const { offerId, isBookmarked } = data;

  if (!offerId) {
    return new Response(
      JSON.stringify({ success: false, error: "Offer ID required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Increment/decrement bookmark count
  const increment = isBookmarked ? 1 : -1;
  
  const { data: updated, error } = await supabase
    .from("salon_offers")
    .update({ 
      bookmarks_count: supabase.raw(`bookmarks_count + ${increment}`)
    })
    .eq("id", offerId)
    .select()
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, data: updated }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

