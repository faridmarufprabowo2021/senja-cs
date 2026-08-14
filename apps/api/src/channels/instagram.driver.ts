import { env } from "../lib/env.js";

export type InstagramSendOptions = {
  recipientId: string;
  text?: string;
  mediaUrl?: string;
  accessToken: string;
};

export async function sendInstagramMessage(opts: InstagramSendOptions) {
  const { recipientId, text, mediaUrl, accessToken } = opts;
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(accessToken)}`;

  let payload: any = {
    recipient: { id: recipientId },
    messaging_type: "RESPONSE",
  };

  if (text) {
    payload.message = { text };
  } else if (mediaUrl) {
    payload.message = {
      attachment: {
        type: "image",
        payload: {
          url: mediaUrl,
          is_reusable: true,
        },
      },
    };
  } else {
    throw new Error("Pesan Instagram harus memiliki teks atau mediaUrl");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as any;
  if (!res.ok || data.error) {
    console.error("[instagram-driver] send error", data.error);
    throw new Error(data.error?.message || "Gagal mengirim pesan ke Instagram");
  }

  return data;
}

/** Send Private Message (DM) to user based on their Instagram Comment ID */
export async function sendInstagramPrivateReply(opts: {
  commentId: string;
  text: string;
  accessToken: string;
}) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(opts.accessToken)}`;
  const payload = {
    recipient: { comment_id: opts.commentId },
    message: { text: opts.text },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as any;
  if (!res.ok || data.error) {
    console.warn("[instagram-driver] private reply error", data.error);
  }
  return data;
}

/** Send Public Reply under Instagram Comment */
export async function sendInstagramPublicCommentReply(opts: {
  commentId: string;
  text: string;
  accessToken: string;
}) {
  const url = `https://graph.facebook.com/v19.0/${opts.commentId}/replies?access_token=${encodeURIComponent(opts.accessToken)}`;
  const payload = {
    message: opts.text,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as any;
  if (!res.ok || data.error) {
    console.warn("[instagram-driver] public comment reply error", data.error);
  }
  return data;
}

/** Fetch Connected Business Instagram Account Profile Details */
export async function fetchInstagramProfile(opts: {
  igUserId?: string | null;
  accessToken: string;
}) {
  const { igUserId, accessToken } = opts;

  // 1. If igUserId is provided, fetch Instagram Business Profile
  if (igUserId?.trim()) {
    const url = `https://graph.facebook.com/v19.0/${igUserId.trim()}?fields=id,username,name,profile_picture_url,followers_count,media_count&access_token=${encodeURIComponent(accessToken)}`;
    try {
      const res = await fetch(url);
      const data = (await res.json()) as any;
      if (res.ok && !data.error && data.id) {
        return {
          id: data.id,
          username: data.username || data.name || "instagram_bisnis",
          name: data.name || null,
          profilePictureUrl: data.profile_picture_url || null,
          followersCount: data.followers_count ?? null,
          mediaCount: data.media_count ?? null,
        };
      }
    } catch (err) {
      console.warn("[instagram-driver] fetchProfile igUserId error", err);
    }
  }

  // 2. Fallback to /me endpoint using user access token
  const meUrl = `https://graph.facebook.com/v19.0/me?fields=id,name,picture&access_token=${encodeURIComponent(accessToken)}`;
  try {
    const res = await fetch(meUrl);
    const data = (await res.json()) as any;
    if (res.ok && !data.error && data.id) {
      return {
        id: data.id,
        username: data.name || "Akun Terhubung",
        name: data.name || "Pemilik Akun",
        profilePictureUrl: data.picture?.data?.url || null,
        followersCount: null,
        mediaCount: null,
      };
    }
  } catch (err) {
    console.error("[instagram-driver] fetchProfile /me fallback error", err);
  }

  return null;
}

/** Fetch Connected Business Instagram Recent Media Posts / Reels */
export async function fetchInstagramMediaList(opts: {
  igUserId: string;
  accessToken: string;
  limit?: number;
}) {
  const limit = opts.limit || 12;
  const url = `https://graph.facebook.com/v19.0/${opts.igUserId}/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&limit=${limit}&access_token=${encodeURIComponent(opts.accessToken)}`;
  try {
    const res = await fetch(url);
    const data = (await res.json()) as any;
    if (!res.ok || data.error) {
      console.warn("[instagram-driver] fetchMediaList error", data.error);
      return [];
    }
    return (data.data || []).map((m: any) => ({
      id: m.id,
      caption: m.caption || null,
      mediaType: m.media_type || "IMAGE",
      mediaUrl: m.media_url || "",
      permalink: m.permalink || "",
      timestamp: m.timestamp || "",
      likeCount: m.like_count ?? null,
      commentsCount: m.comments_count ?? null,
    }));
  } catch (err) {
    console.error("[instagram-driver] fetchMediaList error", err);
    return [];
  }
}
