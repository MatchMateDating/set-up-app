import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Heart, EyeOff, PenLine, Ban, User, SlidersHorizontal, Check } from 'lucide-react';
import AppShell from '../layout/AppShell';
import FilterBottomSheet from '../layout/FilterBottomSheet';
import AgeRangeSlider from '../preferences/ageRangeSlider';
import '../layout/filterBottomSheet.css';
import './match.css';
import SendNoteModal from './sendNoteModal';
import ProfileCard from './profileCard';
import { useProfiles } from "./hooks/useProfiles";
import { useUserInfo } from "./hooks/useUserInfo";
import { startLocationWatcher, stopLocationWatcher } from '../auth/utils/startLocationWatcher';
import { daterNeedsMatchmakerLink } from '../../navigation/matchmakerGate';
import { getRoleAccentColor } from '../../theme/roleTheme';
import { getImageUrl } from '../../utils/imageUtils';
import {
  convertHeightForViewer,
  heightStringToCm,
  normalizeHeightUnit,
} from '../profile/utils/profileUtils';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';

const CARD_STACK_PADDING_TOP = 14;
const MATCHMAKER_CARD_STACK_PADDING_TOP = 32;
const STACK_PREVIEW_PEEK = 12;
const STACK_PREVIEW_PEEK_WITH_NOTE = 16;
const STACK_PREVIEW_ALIGNED_LIFT = 8;
const STACK_PREVIEW_INSET = 10;
const HEIGHT_SLIDER_MIN_CM = 0;
const HEIGHT_SLIDER_MAX_CM_IMPERIAL = Math.round(7 * 30.48 + 11 * 2.54);
const HEIGHT_SLIDER_MAX_CM_METRIC = 299;

const getHeightSliderBoundsCm = (viewerUnit) => {
  const unit = normalizeHeightUnit(viewerUnit);
  if (unit === 'metric') {
    return { minCm: HEIGHT_SLIDER_MIN_CM, maxCm: HEIGHT_SLIDER_MAX_CM_METRIC };
  }
  return { minCm: HEIGHT_SLIDER_MIN_CM, maxCm: HEIGHT_SLIDER_MAX_CM_IMPERIAL };
};

const getInitialMatchFilters = (viewerUnit) => {
  const { minCm, maxCm } = getHeightSliderBoundsCm(viewerUnit);
  return {
    heightMinCm: minCm,
    heightMaxCm: maxCm,
    requireBio: false,
    internalMatchmakingOnly: false,
    heightFilterEnabled: false,
  };
};

const formatCmAsHeightLabel = (cm, viewerUnit) => {
  const m = Math.floor(cm / 100);
  const centimeters = Math.round(cm - m * 100);
  return convertHeightForViewer(`${m}m ${centimeters}cm`, 'metric', viewerUnit);
};

const adjustCurrentIndexAfterRemoval = (prevProfiles, removedId, prevIndex, nextProfiles) => {
  if (nextProfiles.length === 0) return 0;
  const removedIndex = prevProfiles.findIndex((p) => p.id === removedId);
  if (removedIndex < 0) {
    return Math.min(prevIndex, nextProfiles.length - 1);
  }
  if (prevIndex > removedIndex) {
    return Math.min(prevIndex - 1, nextProfiles.length - 1);
  }
  return Math.min(prevIndex, nextProfiles.length - 1);
};

const Match = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();
  const { user: contextUser } = useUser();
  const { profiles, setProfiles, loading } = useProfiles(API_BASE_URL);
  const { userInfo } = useUserInfo(API_BASE_URL);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchModalData, setMatchModalData] = useState(null);
  const [referrer, setReferrer] = useState(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [matchFilters, setMatchFilters] = useState(() =>
    getInitialMatchFilters('Imperial')
  );
  const [filterDraft, setFilterDraft] = useState(() =>
    getInitialMatchFilters('Imperial')
  );
  const gateUser = userInfo || contextUser;
  const isDater = gateUser?.role === 'user';
  const isMatchmaker = gateUser?.role === 'matchmaker';
  const needsMatchmaker = daterNeedsMatchmakerLink(gateUser);
  const accentColor = getRoleAccentColor(gateUser?.role);

  const linkedDaterIdSet = useMemo(() => {
    const ids = userInfo?.linked_daters;
    if (!Array.isArray(ids)) return new Set();
    return new Set(
      ids
        .map((entry) => Number(typeof entry === 'object' ? entry?.id : entry))
        .filter((id) => Number.isFinite(id))
    );
  }, [userInfo?.linked_daters]);

  const showInternalMatchmakingFilter =
    userInfo?.role === 'matchmaker' && linkedDaterIdSet.size >= 2;

  const viewerHeightUnit = userInfo?.unit || contextUser?.unit || 'Imperial';
  const heightBoundsCm = useMemo(
    () => getHeightSliderBoundsCm(viewerHeightUnit),
    [viewerHeightUnit]
  );

  useEffect(() => {
    const { minCm, maxCm } = heightBoundsCm;
    const clampPair = (lo, hi) => {
      let a = Math.min(Math.max(lo, minCm), maxCm);
      let b = Math.min(Math.max(hi, minCm), maxCm);
      if (a > b) return [minCm, maxCm];
      return [a, b];
    };
    setMatchFilters((prev) => {
      const [a, b] = clampPair(prev.heightMinCm, prev.heightMaxCm);
      if (a === prev.heightMinCm && b === prev.heightMaxCm) return prev;
      return { ...prev, heightMinCm: a, heightMaxCm: b };
    });
    setFilterDraft((prev) => {
      const [a, b] = clampPair(prev.heightMinCm, prev.heightMaxCm);
      if (a === prev.heightMinCm && b === prev.heightMaxCm) return prev;
      return { ...prev, heightMinCm: a, heightMaxCm: b };
    });
  }, [heightBoundsCm.minCm, heightBoundsCm.maxCm]);

  const isHeightFilterActive =
    matchFilters.heightFilterEnabled &&
    (matchFilters.heightMinCm > heightBoundsCm.minCm ||
      matchFilters.heightMaxCm < heightBoundsCm.maxCm);

  const internalMatchmakingFilterActive =
    matchFilters.internalMatchmakingOnly &&
    userInfo?.role === 'matchmaker' &&
    linkedDaterIdSet.size >= 2;

  const activeFilterCount =
    (isHeightFilterActive ? 1 : 0) +
    (matchFilters.requireBio ? 1 : 0) +
    (internalMatchmakingFilterActive ? 1 : 0);

  const filterProfilesList = useCallback(
    (list) => {
      const hActive =
        matchFilters.heightFilterEnabled &&
        (matchFilters.heightMinCm > heightBoundsCm.minCm ||
          matchFilters.heightMaxCm < heightBoundsCm.maxCm);
      const internalActive =
        matchFilters.internalMatchmakingOnly &&
        userInfo?.role === 'matchmaker' &&
        linkedDaterIdSet.size >= 2;

      return list.filter((p) => {
        if (hActive) {
          const cm = heightStringToCm(p.height, p.unit);
          if (cm == null || Number.isNaN(cm)) return false;
          if (cm < matchFilters.heightMinCm || cm > matchFilters.heightMaxCm) {
            return false;
          }
        }
        if (matchFilters.requireBio) {
          if (!p.bio || !String(p.bio).trim()) return false;
        }
        if (internalActive && !linkedDaterIdSet.has(Number(p.id))) {
          return false;
        }
        return true;
      });
    },
    [
      matchFilters,
      heightBoundsCm.minCm,
      heightBoundsCm.maxCm,
      userInfo?.role,
      linkedDaterIdSet,
    ]
  );

  const filteredProfiles = useMemo(
    () => filterProfilesList(profiles),
    [filterProfilesList, profiles]
  );

  useEffect(() => {
    if (currentIndex >= filteredProfiles.length && filteredProfiles.length > 0) {
      setCurrentIndex(0);
    }
  }, [filteredProfiles.length, currentIndex]);

  const removeProfileFromDeck = (userId) => {
    setProfiles((prevProfiles) => {
      const beforeFiltered = filterProfilesList(prevProfiles);
      const nextProfiles = prevProfiles.filter((profile) => profile.id !== userId);
      const afterFiltered = filterProfilesList(nextProfiles);
      setCurrentIndex((prevIndex) =>
        adjustCurrentIndexAfterRemoval(
          beforeFiltered,
          userId,
          prevIndex,
          afterFiltered
        )
      );
      return nextProfiles;
    });
  };

  const openMatchModal = (match, likedProfile) => {
    if (!match || (match.status !== 'matched' && match.status !== 'pending_approval')) {
      return;
    }
    const firstImage = likedProfile?.images?.[0]?.image_url || null;
    setMatchModalData({
      matchId: match.id,
      firstName: likedProfile?.first_name || 'someone',
      imageUrl: firstImage ? getImageUrl(firstImage, API_BASE_URL) : null,
      isPendingApproval: match.status === 'pending_approval',
    });
    setShowMatchModal(true);
  };

  const fetchProfile = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/profile/`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          localStorage.removeItem('token');
          window.location.href = '/';
          return;
        }
      }
      const data = await res.json();
      setReferrer(data.referrer || null);
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const fetchReferrer = async (daterId) => {
    if (!daterId) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/profile/${daterId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setReferrer(data.user);
    } catch (err) {
      console.error('Error fetching referrer:', err);
    }
  };

  const fetchProfiles = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/match/users_to_match`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch profiles");
      const data = await res.json();
      setProfiles(data);
    } catch (err) {
      console.error("Error fetching profiles:", err);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Ensure location watcher runs whenever the match page is opened
  useEffect(() => {
    const token = localStorage.getItem('token');
    startLocationWatcher(API_BASE_URL, token);

    const onLocationUpdated = () => {
      fetchProfiles();
    };

    window.addEventListener('locationUpdated', onLocationUpdated);

    return () => {
      window.removeEventListener('locationUpdated', onLocationUpdated);
      stopLocationWatcher();
    };
  }, [API_BASE_URL]);

  const nextProfile = () => {
    if (currentIndex < filteredProfiles.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      alert("No more profiles to show!");
    }
    fetchProfiles();
  };

  const likeUser = async (likedUserId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/';
      return;
    }

    try {
      const likedProfile = filteredProfiles.find((p) => p.id === likedUserId);
      const res = await fetch(`${API_BASE_URL}/match/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ liked_user_id: likedUserId }),
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          localStorage.removeItem('token');
          window.location.href = '/';
        }
        return;
      }

      if (!res.ok) return;

      const data = await res.json();
      removeProfileFromDeck(likedUserId);
      openMatchModal(data.match, likedProfile);
    } catch (err) {
      console.error('Error liking user:', err);
    }
  };

  const blindMatch = async (likedUserId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/';
      return;
    }

    try {
      const likedProfile = filteredProfiles.find((p) => p.id === likedUserId);
      const res = await fetch(`${API_BASE_URL}/match/blind_match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ liked_user_id: likedUserId }),
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          localStorage.removeItem('token');
          window.location.href = '/';
        }
        return;
      }

      if (!res.ok) return;

      const data = await res.json();
      removeProfileFromDeck(likedUserId);
      if (data.match?.status === 'pending_approval') {
        openMatchModal(data.match, likedProfile);
      }
    } catch (err) {
      console.error('Error blind matching:', err);
    }
  };

  const handleLike = () => {
    const likedUser = filteredProfiles[currentIndex];
    if (!likedUser) return;
    likeUser(likedUser.id);
  };

  const blockUser = async (blockedUserId) => {
    const confirmed = window.confirm(
      'Are you sure you want to block this user? You will never see each other again.'
    );
    if (!confirmed) return;

    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/';
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/match/block/${blockedUserId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          localStorage.removeItem('token');
          window.location.href = '/';
          return;
        }
      }

      if (res.ok) {
        removeProfileFromDeck(blockedUserId);
        alert('User blocked successfully');
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to block user');
      }
    } catch (err) {
      console.error('Error blocking user:', err);
      alert('Failed to block user');
    }
  };

  const handleSendNote = async (note) => {
    const likedUser = filteredProfiles[currentIndex];
    if (!likedUser) return;

    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/';
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/match/send_note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipient_id: likedUser.id, note }),
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          localStorage.removeItem('token');
          window.location.href = '/';
        }
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to send note');
        return;
      }

      const data = await res.json();
      setShowNoteModal(false);
      removeProfileFromDeck(likedUser.id);
      openMatchModal(data.match, likedUser);
    } catch (err) {
      console.error('Error sending note:', err);
      alert('Failed to send note');
    }
  };

  const currentProfile =
    filteredProfiles.length > 0 && currentIndex < filteredProfiles.length
      ? filteredProfiles[currentIndex]
      : null;
  const upcomingProfile =
    currentProfile && currentIndex + 1 < filteredProfiles.length
      ? filteredProfiles[currentIndex + 1]
      : null;
  const stackPreviewProfile = upcomingProfile;
  const upcomingHasNote = Boolean(stackPreviewProfile?.note?.trim());
  const currentHasNote = Boolean(currentProfile?.note?.trim());
  const bothNotesPreview = currentHasNote && upcomingHasNote;
  const cardStackPreviewPadding = isMatchmaker
    ? MATCHMAKER_CARD_STACK_PADDING_TOP
    : CARD_STACK_PADDING_TOP;
  const stackPreviewHeight = upcomingHasNote
    ? STACK_PREVIEW_PEEK_WITH_NOTE
    : STACK_PREVIEW_PEEK;
  const stackPreviewTop = bothNotesPreview
    ? -STACK_PREVIEW_ALIGNED_LIFT
    : cardStackPreviewPadding - stackPreviewHeight;
  const preferredViewerUnit =
    userInfo?.role === 'matchmaker' ? referrer?.unit : undefined;
  const hasProfilesButFilteredOut =
    profiles.length > 0 && filteredProfiles.length === 0;
  const heightLabelUnit = viewerHeightUnit;

  const dismissFilterSheet = () => {
    setFilterDraft({ ...matchFilters });
    setShowFilterSheet(false);
  };

  const saveFilterSheet = () => {
    const changed =
      matchFilters.heightMinCm !== filterDraft.heightMinCm ||
      matchFilters.heightMaxCm !== filterDraft.heightMaxCm ||
      matchFilters.heightFilterEnabled !== filterDraft.heightFilterEnabled ||
      matchFilters.requireBio !== filterDraft.requireBio ||
      matchFilters.internalMatchmakingOnly !== filterDraft.internalMatchmakingOnly;
    if (changed) setCurrentIndex(0);
    setMatchFilters({ ...filterDraft });
    setShowFilterSheet(false);
  };

  const updateHeightDraft = (lo, hi) => {
    const atFullRange =
      lo === heightBoundsCm.minCm && hi === heightBoundsCm.maxCm;
    setFilterDraft((d) => ({
      ...d,
      heightMinCm: lo,
      heightMaxCm: hi,
      heightFilterEnabled: !atFullRange,
    }));
  };

  const filterHeaderTrailing = (
    <button
      type="button"
      className={`app-shell-filter-btn${isDater ? ' app-shell-filter-btn-dater' : ''}`}
      onClick={() => {
        setFilterDraft({ ...matchFilters });
        setShowFilterSheet(true);
      }}
      aria-label="Open match filters"
    >
      <SlidersHorizontal size={22} color="#374151" />
      {activeFilterCount > 0 ? (
        <span
          className="app-shell-filter-badge"
          style={{ backgroundColor: accentColor }}
        >
          {activeFilterCount}
        </span>
      ) : null}
    </button>
  );

  if (loading) {
    return (
      <AppShell headerTrailing={filterHeaderTrailing}>
        <p className="match-empty">Loading profiles...</p>
      </AppShell>
    );
  }

  if (needsMatchmaker) {
    return (
      <AppShell>
        <div className="match-container match-gate">
          <p className="match-empty match-gate-text">
            You can&apos;t see matches until you have a matchmaker. Go to Settings
            → Referral Code to share your referral code with a matchmaker.
          </p>
          <button
            type="button"
            className="match-gate-button"
            onClick={() =>
              navigate('/settings?requireMatchmaker=1&openReferral=1')
            }
          >
            Open Referral Settings
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      headerTrailing={filterHeaderTrailing}
      onSelectedDaterChange={(newDaterId) => {
        fetchReferrer(newDaterId);
        fetchProfiles();
      }}
    >
      <div className="match-screen">
        <div
          className={`match-container${isMatchmaker ? ' match-container-matchmaker' : ''}${
            isDater ? ' match-container-dater' : ''
          }`}
        >
          {currentProfile ? (
            <div
              className={`match-card-stack${
                bothNotesPreview ? ' match-card-stack-both-notes' : ''
              }`}
              style={{ paddingTop: cardStackPreviewPadding }}
            >
              {stackPreviewProfile ? (
                <div
                  className="match-stack-preview-layer"
                  style={{
                    top: stackPreviewTop,
                    ...(bothNotesPreview
                      ? null
                      : {
                          height: stackPreviewHeight,
                          overflow: 'hidden',
                        }),
                    left: STACK_PREVIEW_INSET,
                    right: STACK_PREVIEW_INSET,
                  }}
                  aria-hidden="true"
                >
                  <div className="match-stack-preview-scaled">
                    <ProfileCard
                      profile={stackPreviewProfile}
                      userInfo={userInfo}
                      preferredViewerUnit={preferredViewerUnit}
                      isStackPreview
                      stackPreviewAligned={bothNotesPreview}
                    />
                  </div>
                </div>
              ) : null}
              <div className="match-current-card">
                <ProfileCard
                  profile={currentProfile}
                  userInfo={userInfo}
                  preferredViewerUnit={preferredViewerUnit}
                  onSkip={nextProfile}
                />
              </div>
            </div>
          ) : (
            <p className="match-empty">
              {hasProfilesButFilteredOut
                ? 'No profiles match your filters. Adjust filters to see more people.'
                : 'No profiles to match with currently, come back later!'}
            </p>
          )}
        </div>

        {currentProfile ? (
          <>
            <div className="match-action-bar">
              <div className="match-action-side match-action-left">
                {isDater && (
                  <button
                    type="button"
                    className="match-action-button"
                    onClick={() => blockUser(currentProfile.id)}
                    aria-label="Block user"
                  >
                    <Ban size={26} color="#ef4444" />
                  </button>
                )}
                {isMatchmaker && !currentProfile.liked_linked_dater && (
                  <button
                    type="button"
                    className="match-action-button"
                    onClick={() => blindMatch(currentProfile.id)}
                    aria-label="Blind match"
                  >
                    <EyeOff size={24} color="#6c5ce7" />
                  </button>
                )}
              </div>
              <div className="match-action-center">
                <button
                  type="button"
                  className="match-action-button match-like-button"
                  onClick={
                    isMatchmaker && currentProfile.liked_linked_dater
                      ? () => blindMatch(currentProfile.id)
                      : handleLike
                  }
                  aria-label="Like"
                >
                  <Heart size={32} color="#ef4d73" fill="#ef4d73" />
                </button>
              </div>
              <div className="match-action-side match-action-right">
                <button
                  type="button"
                  className="match-action-button"
                  onClick={() => setShowNoteModal(true)}
                  aria-label="Send note"
                >
                  <PenLine
                    size={24}
                    color={isMatchmaker ? '#6c5ce7' : '#374151'}
                  />
                </button>
              </div>
            </div>
            {showNoteModal && (
              <SendNoteModal
                onClose={() => setShowNoteModal(false)}
                onSend={handleSendNote}
              />
            )}
          </>
        ) : null}
      </div>

      <FilterBottomSheet
        open={showFilterSheet}
        accentColor={accentColor}
        onClose={dismissFilterSheet}
        onSave={saveFilterSheet}
      >
        <span className="filter-section-label">HEIGHT</span>
        <p className="filter-section-hint">
          Select a height range you&apos;re looking for
        </p>
        <div className="filter-height-values">
          <div
            className="filter-height-box"
            style={{ borderColor: accentColor, color: accentColor }}
          >
            {formatCmAsHeightLabel(filterDraft.heightMinCm, heightLabelUnit)}
          </div>
          <span className="filter-height-dash">–</span>
          <div
            className="filter-height-box"
            style={{ borderColor: accentColor, color: accentColor }}
          >
            {formatCmAsHeightLabel(filterDraft.heightMaxCm, heightLabelUnit)}
          </div>
        </div>
        <div className="filter-slider-wrap">
          <AgeRangeSlider
            min={heightBoundsCm.minCm}
            max={heightBoundsCm.maxCm}
            minValue={filterDraft.heightMinCm}
            maxValue={filterDraft.heightMaxCm}
            step={1}
            accentColor={accentColor}
            onChange={updateHeightDraft}
            className="filter-height-range-slider"
          />
        </div>

        <div className="filter-section-divider" />

        <span className="filter-section-label">ABOUT ME</span>
        <button
          type="button"
          className="filter-checkbox-row"
          onClick={() =>
            setFilterDraft((d) => ({ ...d, requireBio: !d.requireBio }))
          }
        >
          <span
            className="filter-checkbox"
            style={{
              borderColor: accentColor,
              backgroundColor: filterDraft.requireBio ? '#fff' : '#fff',
            }}
          >
            {filterDraft.requireBio ? (
              <Check size={16} color={accentColor} strokeWidth={3} />
            ) : null}
          </span>
          <span className="filter-checkbox-label">About Me Filled Out</span>
        </button>

        {showInternalMatchmakingFilter ? (
          <>
            <div className="filter-section-divider" />
            <span className="filter-section-label">INTERNAL MATCHMAKING</span>
            <p className="filter-section-sub">
              Limit the deck to people on your roster (other linked daters you
              work with).
            </p>
            <button
              type="button"
              className="filter-checkbox-row"
              onClick={() =>
                setFilterDraft((d) => ({
                  ...d,
                  internalMatchmakingOnly: !d.internalMatchmakingOnly,
                }))
              }
            >
              <span
                className="filter-checkbox"
                style={{ borderColor: accentColor }}
              >
                {filterDraft.internalMatchmakingOnly ? (
                  <Check size={16} color={accentColor} strokeWidth={3} />
                ) : null}
              </span>
              <span className="filter-checkbox-label">
                Only show my linked daters
              </span>
            </button>
          </>
        ) : null}
      </FilterBottomSheet>

      {showMatchModal && matchModalData && (
        <div
          className="match-found-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-found-title"
        >
          <div className="match-found-modal">
            {matchModalData.imageUrl ? (
              <img
                src={matchModalData.imageUrl}
                alt=""
                className="match-found-image"
                style={{ borderColor: accentColor }}
              />
            ) : (
              <div
                className="match-found-image-placeholder"
                style={{ borderColor: accentColor }}
              >
                <User size={48} color="#ccc" />
              </div>
            )}
            <h2 id="match-found-title" className="match-found-title">
              {matchModalData.isPendingApproval ? 'Match Found!' : "It's a Match!"}
            </h2>
            <p className="match-found-subtitle">
              {matchModalData.isPendingApproval
                ? `Start the conversation with ${matchModalData.firstName}`
                : `You and ${matchModalData.firstName} liked each other`}
            </p>
            <button
              type="button"
              className="match-found-primary"
              style={{ backgroundColor: accentColor }}
              onClick={() => {
                const matchId = matchModalData.matchId;
                setShowMatchModal(false);
                setMatchModalData(null);
                if (matchId != null) {
                  navigate(`/conversation/${matchId}`);
                }
              }}
            >
              {matchModalData.isPendingApproval
                ? 'Start Conversation'
                : 'Send a Message'}
            </button>
            <button
              type="button"
              className="match-found-dismiss"
              onClick={() => {
                setShowMatchModal(false);
                setMatchModalData(null);
              }}
            >
              Keep Swiping
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default Match;
