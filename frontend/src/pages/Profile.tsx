import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, MapPin, CheckCircle, Package, Loader2, LogOut, Settings, X, Check, Camera } from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';
import { useAuth } from '../store/AuthContext';
import { useSettings } from '../store/SettingsContext';
import { apiClient } from '../api/client';

interface Review {
  id:          string;
  rating:      number;
  comment?:    string;
  reviewer_id: string;
  created_at:  string;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, checkAuth, logout } = useAuth();
  const { t } = useSettings();

  const [reviews, setReviews]           = useState<Review[]>([]);
  const [gearCount, setGearCount]       = useState<number | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // ── Edit Profile modal ────────────────────────────────────────────────────
  const [showEdit, setShowEdit]     = useState(false);
  const [editName, setEditName]     = useState('');
  const [editBio, setEditBio]       = useState('');
  const [editPhone, setEditPhone]         = useState('');
  const [avatarFile, setAvatarFile]       = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving]               = useState(false);
  const [saveError, setSaveError]         = useState('');
  const fileInputRef                      = useRef<HTMLInputElement>(null);

  const openEdit = () => {
    setEditName(user?.name ?? '');
    setEditBio(user?.bio ?? '');
    setEditPhone(user?.phone ?? '');
    setAvatarFile(null);
    setAvatarPreview(null);
    setSaveError('');
    setShowEdit(true);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editName.trim()) { setSaveError('Name is required'); return; }
    setSaving(true);
    setSaveError('');
    try {
      let avatar_url: string | undefined;
      if (avatarFile) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        const { data: up } = await apiClient.post('/uploads', fd, {
          headers: { 'Content-Type': undefined },
        });
        avatar_url = up.url;
      }
      await apiClient.patch('/users/me', {
        name:       editName.trim(),
        bio:        editBio.trim()   || undefined,
        phone:      editPhone.trim() || undefined,
        avatar_url,
      });
      await checkAuth();
      setShowEdit(false);
    } catch (err: any) {
      setSaveError(err.response?.data?.error || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  // ── Data fetching ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    apiClient.get(`/reviews/${user.id}`)
      .then(res => setReviews(res.data.reviews || []))
      .catch(() => setReviews([]))
      .finally(() => setLoadingReviews(false));

    apiClient.get('/gear/mine')
      .then(res => setGearCount((res.data.items || []).length))
      .catch(() => setGearCount(0));
  }, [user?.id]);

  const avgRating = user?.avg_rating
    ? parseFloat(user.avg_rating).toFixed(1)
    : reviews.length
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  const initials = user?.name
    ?.split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

  return (
    <div className="flex flex-col h-full animate-slide-up">

      {/* Header */}
      <div className="px-4 pt-6 pb-0 text-center relative">
        {/* Avatar */}
        <div className="w-24 h-24 mx-auto rounded-full border-4 border-bg-glass-border bg-gray-800 flex items-center justify-center mb-4 relative overflow-hidden">
          {user?.avatar_url
            ? <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
            : <span className="text-3xl font-bold text-white">{initials}</span>
          }
          <div className="absolute bottom-0.5 right-0.5 w-5 h-5 bg-green-500 rounded-full border-2 border-bg-primary" />
        </div>

        <h1 className="text-2xl font-bold mb-1 flex items-center justify-center gap-2">
          {user?.name ?? 'Loading...'}
          {user?.is_verified && <VerifiedBadge size="md" />}
        </h1>

        {user?.bio && (
          <p className="text-secondary text-sm mb-2 px-4">{user.bio}</p>
        )}

        <p className="text-secondary text-sm flex items-center justify-center gap-1 mb-5">
          <MapPin size={13} className="text-accent-cyan" />
          Buenos Aires, Argentina
        </p>

        {/* Stats row */}
        <div className="flex justify-center gap-6 mb-6">
          <div className="flex flex-col items-center">
            <span className="text-xl font-extrabold text-white flex items-center gap-1">
              <Star size={16} className="text-yellow-400 fill-yellow-400" />
              {avgRating ?? '—'}
            </span>
            <span className="text-xs text-muted mt-0.5">Rating</span>
          </div>

          <div className="w-px bg-bg-glass-border" />

          <div className="flex flex-col items-center">
            <span className="text-xl font-extrabold text-white flex items-center gap-1">
              <CheckCircle size={16} className="text-accent-cyan" />
              {user?.review_count ?? reviews.length}
            </span>
            <span className="text-xs text-muted mt-0.5">Reviews</span>
          </div>

          <div className="w-px bg-bg-glass-border" />

          <div className="flex flex-col items-center">
            <span className="text-xl font-extrabold text-white flex items-center gap-1">
              <Package size={16} className="text-accent-purple" />
              {gearCount ?? '—'}
            </span>
            <span className="text-xs text-muted mt-0.5">Items</span>
          </div>
        </div>
      </div>

      {/* Reviews section */}
      <div className="flex-1 bg-bg-secondary rounded-t-3xl pt-6 px-4 overflow-y-auto pb-28 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">

        <h3 className="text-base font-bold mb-4 flex items-center gap-2">
          <Star size={16} className="text-yellow-400 fill-yellow-400" />
          Reviews
        </h3>

        {loadingReviews ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-accent-cyan" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-10">
            <Star size={36} className="text-gray-700 mx-auto mb-3" />
            <p className="text-secondary text-sm">No reviews yet.</p>
            <p className="text-muted text-xs mt-1">Complete transactions to collect reviews.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map(review => (
              <div key={review.id} className="glass-panel p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-sm text-secondary">Anonymous</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star
                        key={s}
                        size={13}
                        className={s <= review.rating
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-700'}
                      />
                    ))}
                  </div>
                </div>
                {review.comment && (
                  <p className="text-sm text-secondary leading-relaxed">"{review.comment}"</p>
                )}
                <p className="text-xs text-muted mt-2">
                  {new Date(review.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 space-y-3">
          <button
            onClick={openEdit}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl glass-panel text-sm font-medium hover:bg-white/5 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Camera size={16} className="text-muted" />
              {t('profile.editProfile')}
            </span>
            <span className="text-muted text-xs">Name, bio, phone</span>
          </button>

          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl glass-panel text-sm font-medium hover:bg-white/5 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Settings size={16} className="text-muted" />
              {t('profile.settings')}
            </span>
            <span className="text-muted text-xs">Language, theme</span>
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-red-500/20 text-urgency-emergency text-sm font-bold hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={16} />
            {t('profile.signOut')}
          </button>
        </div>
      </div>

      {/* ── Edit Profile Modal ──────────────────────────────────────────────── */}
      {showEdit && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowEdit(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-bg-secondary rounded-t-3xl border-t border-bg-glass-border animate-slide-up"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-600 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex justify-between items-center px-5 py-3 border-b border-bg-glass-border mb-2">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Camera size={16} className="text-accent-cyan" />
                Edit Profile
              </h2>
              <button onClick={() => setShowEdit(false)} className="text-muted hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="px-5 pb-2 space-y-4">
              {saveError && (
                <p className="text-sm text-urgency-emergency bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {saveError}
                </p>
              )}

              {/* Avatar */}
              <div>
                <label className="text-xs text-muted uppercase tracking-wider mb-1.5 block">
                  Profile Photo
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <div className="flex items-center gap-4">
                  {/* Preview */}
                  <div className="w-16 h-16 rounded-full bg-gray-800 border-2 border-bg-glass-border overflow-hidden flex items-center justify-center shrink-0">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : user?.avatar_url ? (
                      <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-white">{initials}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-bg-glass-border text-sm font-medium text-secondary hover:text-white hover:border-accent-cyan/50 transition-all"
                  >
                    <Camera size={15} />
                    {avatarPreview ? 'Change photo' : 'Upload photo'}
                  </button>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}
                      className="text-muted hover:text-urgency-emergency transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs text-muted uppercase tracking-wider mb-1.5 block">
                  Display Name *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-accent-cyan outline-none transition-colors"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="text-xs text-muted uppercase tracking-wider mb-1.5 block">
                  Bio
                </label>
                <textarea
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  placeholder="Drummer, FOH engineer, gear nerd..."
                  rows={3}
                  maxLength={200}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-accent-cyan outline-none transition-colors resize-none"
                />
                <p className="text-[10px] text-muted text-right mt-1">{editBio.length}/200</p>
              </div>

              {/* Phone */}
              <div>
                <label className="text-xs text-muted uppercase tracking-wider mb-1.5 block">
                  Phone (optional)
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  placeholder="+54 11 1234-5678"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-accent-cyan outline-none transition-colors"
                />
              </div>

              {/* Save */}
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent-cyan text-black font-bold text-sm disabled:opacity-60 mt-2"
              >
                {saving
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Check size={16} />
                }
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
