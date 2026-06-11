import { useState, useEffect } from "react";
import { Star, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface SalonReviewsProps {
  salonId: string;
  reviews: any[];
  rating: number;
  reviewCount: number;
}

const SalonReviews = ({ salonId, reviews: initialReviews, rating, reviewCount }: SalonReviewsProps) => {
  const [reviews, setReviews] = useState<any[]>(initialReviews || []);
  const [showForm, setShowForm] = useState(false);
  const [newRating, setNewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("You");
  const [displayCount, setDisplayCount] = useState(4);

  // Always fetch fresh reviews from DB on mount
  useEffect(() => {
    const fetchReviews = async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, customers(full_name)")
        .eq("salon_id", salonId)
        .order("created_at", { ascending: false });
      if (!error && data) setReviews(data);
    };
    if (salonId) fetchReviews();
  }, [salonId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        const profile = JSON.parse(localStorage.getItem("rez1-profile") || "{}");
        setUserName(profile.name || "You");
      }
    });
  }, []);

  const totalCount = reviews.length;
  const avgRating = totalCount > 0
    ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / totalCount).toFixed(1))
    : rating;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!userId) {
      toast.error("You must be logged in to review");
      return;
    }
    const trimmed = comment.trim();
    if (newRating === 0) { toast.error("Please select a rating"); return; }
    if (!trimmed || trimmed.length < 5) { toast.error("Review must be at least 5 characters"); return; }
    if (trimmed.length > 500) { toast.error("Review must be under 500 characters"); return; }
    if (isSubmitting) return;

    setIsSubmitting(true);
    const { data, error } = await supabase.from('reviews').insert({
      salon_id: salonId,
      customer_id: userId,
      rating: newRating,
      comment: trimmed
    }).select('*, customers(full_name)').maybeSingle();

    if (error) {
      toast.error("Failed to submit review");
      console.error(error);
    } else {
      // Calculate new averages
      const newTotalCount = totalCount + 1;
      const newAvgRating = Number(((reviews.reduce((sum, r) => sum + r.rating, 0) + newRating) / newTotalCount).toFixed(1));

      // Update the salon table directly via the edge function to bypass RLS
      await supabase.functions.invoke("admin-api", {
        body: {
          action: "UPDATE",
          table: "salons",
          id: salonId,
          data: {
            rating: newAvgRating,
            review_count: newTotalCount
          }
        }
      });

      setReviews([data, ...reviews]);
      setComment("");
      setNewRating(0);
      setShowForm(false);
      toast.success("Review submitted!");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-foreground">Reviews</h3>
        {!showForm && userId && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Write a review
          </button>
        )}
      </div>

      {/* Rating summary */}
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">{avgRating || 0}</p>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className={`h-3 w-3 ${s <= Math.round(avgRating || 0) ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
            ))}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{totalCount} reviews</p>
        </div>
        <div className="h-12 w-px bg-border" />
        <p className="text-xs text-muted-foreground">Based on verified customer experiences</p>
      </div>

      {/* Review form */}
      {showForm && (
        <div className="mb-4 rounded-2xl border border-primary/30 bg-card p-4">
          <p className="mb-2 text-sm font-medium text-foreground">Your rating</p>
          <div className="mb-3 flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setNewRating(s)}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
              >
                <Star
                  className={`h-6 w-6 transition-colors ${
                    s <= (hoverRating || newRating)
                      ? "fill-primary text-primary"
                      : "text-muted-foreground/30"
                  }`}
                />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience..."
            maxLength={500}
            className="mb-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
            rows={3}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{comment.length}/500</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(false); setNewRating(0); setComment(""); }}
                className="rounded-xl px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-transform active:scale-[0.97] disabled:opacity-70"
              >
                <Send className="h-3 w-3" />
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual reviews */}
      <div className="space-y-3">
        {reviews.slice(0, displayCount).map((review) => {
          const reviewerName = review.customers?.full_name || review.userName || "Anonymous";
          const reviewDate = review.created_at || review.date;
          return (
            <div key={review.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {reviewerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{reviewerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {reviewDate ? new Date(reviewDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                    </p>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`h-3 w-3 ${s <= review.rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
            </div>
          );
        })}
      </div>
      {reviews.length > displayCount && (
        <button
          onClick={() => setDisplayCount(prev => prev + 10)}
          className="mt-4 w-full rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Show More
        </button>
      )}
    </div>
  );
};

export default SalonReviews;
