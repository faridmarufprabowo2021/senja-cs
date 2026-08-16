export type TenantRole = "owner" | "admin" | "agent";

export type ConversationStatus =
  | "new"
  | "bot_active"
  | "waiting_agent"
  | "assigned"
  | "resolved";

export type ConversationMode = "bot" | "human";

export type MessageDirection = "in" | "out";

export type SenderType = "customer" | "bot" | "agent" | "system";

export type MessageType = "text" | "image" | "audio" | "document" | "call_summary" | "system";

export type WaEngineType = "baileys" | "openwa";

export type WaSessionStatus =
  | "pending"
  | "qr"
  | "connected"
  | "disconnected";

export type KnowledgeDocStatus = "processing" | "ready" | "failed";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  avatarHue?: number;
  tags?: string[];
  lastMessageAt: string;
}

export type ChannelType = "whatsapp" | "instagram" | "telegram";

export interface Conversation {
  id: string;
  contact: Contact;
  channel?: ChannelType;
  status: ConversationStatus;
  mode: ConversationMode;
  waSessionId?: string | null;
  assignedTo?: string | null;
  assignedName?: string | null;
  aiAgentId?: string | null;
  aiAgentName?: string | null;
  unreadCount: number;
  lastMessagePreview: string;
  lastMessageAt: string;
  /** Contact tags (shared labels for queue) */
  tags?: string[];
}

export interface AiSourceChunk {
  id: string;
  documentId?: string;
  title: string;
  score: number;
  snippet: string;
  fileUrl?: string;
}

export interface AiSourceMeta {
  query: string;
  engine: string;
  retrievedAt: string;
  chunks: AiSourceChunk[];
}

export interface Message {
  id: string;
  conversationId: string;
  channel?: ChannelType;
  direction: MessageDirection;
  senderType: SenderType;
  senderName?: string;
  type: MessageType;
  body: string;
  createdAt: string;
  metadata?: {
    citations?: { title: string; score: number }[];
    aiSource?: AiSourceMeta;
    confidence?: number;
    escalated?: boolean;
    escalateReason?: string;
    preferredRole?: "admin" | "agent";
    skill?: string;
    mediaUrl?: string;
    mimeType?: string;
    fileName?: string;
    transcript?: string;
    imageAnalysis?: string;
    callSummary?: {
      durationSec?: number;
      summary: string;
      keyTakeaways: string[];
      actionItems: string[];
      isMissedCall?: boolean;
    };
    tool?: string;
    away?: boolean;
  };
}

export interface AiCorrection {
  id: string;
  conversationId: string;
  messageId: string;
  userQuery: string;
  originalBotReply: string;
  correctedReply: string;
  rating: number;
  feedbackNote?: string | null;
  createdByName: string;
  createdAt: string;
}

export interface InstagramChannelConfig {
  connected: boolean;
  pageId?: string | null;
  userId?: string | null;
  accessTokenMasked?: string | null;
}

export interface InstagramCommentRule {
  id: string;
  name: string;
  active: boolean;
  targetPostId?: string | null;
  keywords: string;
  publicReplyText?: string | null;
  privateReplyText: string;
  flowId?: string | null;
  createdAt: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  sourceType: "pdf" | "txt" | "md" | "faq" | "image" | "video";
  status: KnowledgeDocStatus;
  chunkCount?: number;
  fileUrl?: string;
  imageUrl?: string;
  imageName?: string;
  imageCaption?: string;
  updatedAt: string;
}

export interface BotSettings {
  enabled: boolean;
  systemPrompt: string;
  confidenceThreshold: number;
  handoverKeywords: string[];
  maxBotTurns: number;
  model: string;
  businessHoursEnabled: boolean;
  businessHoursStart: string;
  businessHoursEnd: string;
  businessHoursTz: string;
  awayMessage: string;
  quickReplies: string[];
  cancelDeadlineHours?: number;
  shippingOrigin?: string;
  dailyReportEnabled?: boolean;
  dailyReportTime?: string;
  dailyReportChannel?: string;
  telegramBotToken?: string | null;
  telegramChatId?: string | null;
  ownerPhone?: string | null;
}

export interface AiAgent {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  avatarUrl?: string | null;
  enabled: boolean;
  isDefault: boolean;
  systemPrompt: string;
  welcomeMessage: string;
  welcomeImageUrl?: string | null;
  model: string;
  confidenceThreshold: number;
  handoverKeywords: string[];
  cancelDeadlineHours: number;
  transferConditions?: string | null;
  followupEnabled: boolean;
  followupAiDynamic: boolean;
  followupDelayMinutes: number;
  followupMessage: string;
  followupStage2Enabled: boolean;
  followupStage2DelayMinutes: number;
  followupStage2Message: string;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  quietHoursTz?: string;
  waSessionId?: string | null;
  channel: string;
  createdAt: string;
  updatedAt: string;
  knowledgeDocIds?: string[];
}

export interface WaSession {
  id: string;
  engine?: WaEngineType;
  label: string;
  phone?: string;
  status: WaSessionStatus;
  errorCode?: string | null;
  lastSeenAt?: string;
}

export interface DashboardMetrics {
  openChats: number;
  waitingAgent: number;
  botResolvedPct: number;
  avgFirstResponseSec: number;
  messagesToday: number;
}

export interface AnalyticsTrendPoint {
  date: string;
  label: string;
  chatsInbound: number;
  ordersCreated: number;
  ordersPaid: number;
  revenuePaid: number;
}

export interface FunnelStage {
  stage: "chats" | "bot_replied" | "order_draft" | "order_paid";
  label: string;
  count: number;
  conversionPct: number;
}

export interface AgentLeaderboardItem {
  id: string;
  name: string;
  role: string;
  assignedChats: number;
  resolvedChats: number;
  avgResponseSec: number;
}

export interface DashboardAnalytics {
  metrics: DashboardMetrics;
  trends: AnalyticsTrendPoint[];
  funnel: FunnelStage[];
  leaderboard: AgentLeaderboardItem[];
}

export type SubscriptionPlan = "starter" | "pro" | "enterprise";

export const SUBSCRIPTION_PLAN_LABEL: Record<SubscriptionPlan, string> = {
  starter: "Starter (Trial 3 Hari)",
  pro: "Pro (Rp199.000/bln)",
  enterprise: "Enterprise (Rp499.000/bln)",
};

export interface SubscriptionInfo {
  plan: SubscriptionPlan;
  planExpiresAt: string | null;
  isExpired: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  maxAgents: number;
  maxWaSessions: number;
  features: {
    broadcast: boolean;
    ragKnowledge: boolean;
    crmExport: boolean;
  };
}

export interface SubscriptionTransactionItem {
  id: string;
  plan: SubscriptionPlan;
  amount: number;
  status: "pending" | "paid" | "failed";
  snapRedirectUrl: string | null;
  createdAt: string;
  paidAt: string | null;
}

export type MemberStatus = "active" | "invited" | "disabled";

export type WorkspaceVertical = "commerce" | "booking";

export type OrderStatus =
  | "draft"
  | "confirmed"
  | "paid"
  | "done"
  | "cancelled";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TenantRole;
  status: MemberStatus;
  joinedAt?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number | null;
  unit: string;
  active: boolean;
  imageUrl?: string | null;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  status: OrderStatus;
  total: number;
  note: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed";

export interface Booking {
  id: string;
  status: BookingStatus;
  serviceName: string;
  bookingDate: string;
  note: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSettings {
  id: string;
  name: string;
  slug: string;
  plan: string;
  vertical: WorkspaceVertical;
  /** B1 payment instructions */
  payBank: string;
  payAccount: string;
  payAccountName: string;
  payNote: string;
  midtransServerKey?: string;
  midtransClientKey?: string;
  midtransMerchantId?: string;
  midtransIsProduction?: boolean;
  invoiceHeader?: string;
  invoiceFooter?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  invoiceCustomTemplate?: string;
  receiptCustomTemplate?: string;
  useCustomInvoiceTemplate?: boolean;
}

export const STATUS_LABEL: Record<ConversationStatus, string> = {
  new: "Baru",
  bot_active: "Bot",
  waiting_agent: "Menunggu",
  assigned: "Ditangani",
  resolved: "Selesai",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "Draft",
  confirmed: "Dikonfirmasi",
  paid: "Dibayar",
  done: "Selesai",
  cancelled: "Batal",
};

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Menunggu",
  confirmed: "Dikonfirmasi",
  cancelled: "Batal",
  completed: "Selesai",
};

export const VERTICAL_LABEL: Record<WorkspaceVertical, string> = {
  commerce: "Toko / F&B / Retail",
  booking: "Klinik / Salon / Jasa",
};

export interface ContactSummary {
  id: string;
  waJid: string;
  phone: string;
  name: string;
  avatarHue: number;
  tags: string[];
  totalSpent: number;
  orderCount: number;
  bookingCount: number;
  lastMessageAt: string;
  createdAt: string;
}

export interface ContactDetail extends ContactSummary {
  orders: Order[];
  bookings: Booking[];
}

export type CampaignStatus =
  | "draft"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  status: "pending" | "sent" | "failed";
  sentAt?: string;
  error?: string;
}

export interface BroadcastTemplate {
  id: string;
  name: string;
  message: string;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  message: string;
  imageUrl?: string | null;
  targetTag?: string | null;
  status: CampaignStatus;
  delayMinSec: number;
  delayMaxSec: number;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Draft",
  running: "Berjalan (Sending)",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  failed: "Gagal",
};

export interface PipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  color: string;
  orderIndex: number;
  autoRules?: string | null;
  createdAt: string;
  updatedAt: string;
  deals?: PipelineDeal[];
}

export interface PipelineDeal {
  id: string;
  tenantId: string;
  pipelineId: string;
  stageId: string;
  contactId: string;
  conversationId?: string | null;
  title: string;
  amount: number;
  status: "open" | "won" | "lost";
  lastAiReason?: string | null;
  createdAt: string;
  updatedAt: string;
  contact?: ContactSummary;
  stage?: PipelineStage;
}

export interface Pipeline {
  id: string;
  tenantId: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
  deals?: PipelineDeal[];
  createdAt: string;
  updatedAt: string;
}

export interface InstagramProfileData {
  id: string;
  username: string;
  name?: string | null;
  profilePictureUrl?: string | null;
  followersCount?: number | null;
  mediaCount?: number | null;
}

export interface InstagramMediaItem {
  id: string;
  caption?: string | null;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | string;
  mediaUrl: string;
  permalink: string;
  timestamp: string;
  likeCount?: number | null;
  commentsCount?: number | null;
}

export interface MidtransTestResult {
  ok: boolean;
  environment: "sandbox" | "production";
  merchantId?: string;
  error?: string;
}

export interface ShippingTrackResponse {
  ok: boolean;
  courier: string;
  waybillNumber: string;
  status: string;
  origin?: string;
  destination?: string;
  receiverName?: string;
  history: Array<{
    date: string;
    description: string;
    location?: string;
  }>;
  message?: string;
}

export interface ShippingRateItem {
  courier: string;
  service: string;
  description: string;
  cost: number;
  etd: string;
}

export interface ShippingRateResponse {
  ok: boolean;
  origin: string;
  destination: string;
  rates: ShippingRateItem[];
}
