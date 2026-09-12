export interface ZhihuEnvelope<T> {
  Code: number;
  Message?: string;
  Data: T;
}

export interface Paging {
  IsEnd: boolean;
  NextOffset?: string;
  Totals: number;
}

export interface ZhihuProfile {
  name: string | null;
  avatarUrl: string | null;
  headline: string | null;
  url: string | null;
}

export interface HotListItem {
  Title: string;
  Url: string;
  ThumbnailUrl: string;
  Summary: string;
}

export interface HotListData {
  Total: number;
  Items: HotListItem[];
}

export interface CommentInfo {
  Content: string;
}

export interface SearchItem {
  Title: string;
  ContentType: string;
  ContentID: string;
  ContentText: string;
  Url: string;
  CommentCount: number;
  VoteUpCount: number;
  AuthorName: string;
  AuthorAvatar: string;
  AuthorBadge: string;
  AuthorBadgeText: string;
  EditTime: number;
  CommentInfoList?: CommentInfo[];
  AuthorityLevel: string;
  RankingScore?: number;
}

export interface GlobalSearchData {
  HasMore: boolean;
  Items: SearchItem[];
}

export interface QuestionAnswerItem {
  ContentType: string;
  ContentToken: string;
  Url: string;
  Summary: string;
}

export interface QuestionAnswersData {
  Items: QuestionAnswerItem[];
  Paging: {
    IsEnd: boolean;
    NextOffset?: string | number;
    Totals?: string | number;
  };
}

export interface FolloweeItem {
  Fullname: string;
  UrlToken: string;
  Url: string;
  AvatarUrl: string;
  Headline: string;
  Gender: number;
  FollowerCount: number;
}

export interface FolloweeListData {
  Items: FolloweeItem[];
  Paging: Paging;
}

export interface UserContentItem {
  ContentType: string;
  Url: string;
  CreatedAt: number;
  LikeCount: number;
  CommentCount: number;
  FavoriteCount: number;
  Title: string;
  Summary: string;
}

export interface UserContentData {
  Items: UserContentItem[];
  Paging: Paging;
}

export interface FavlistRecord {
  UrlToken: number | string;
  Url: string;
  Title: string;
  Description: string;
  IsPublic: boolean;
}

export interface FavlistListData {
  Items: FavlistRecord[];
}

export interface CollectionContentData {
  Items: UserContentItem[];
  Paging?: Paging;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type ZhiDaModel = "zhida-fast-1p5" | "zhida-thinking-1p5" | "zhida-agent";

export interface ZhiDaChoice {
  index?: number;
  message?: {
    role?: string;
    content?: string;
    reasoning_content?: string;
  };
  finish_reason?: string;
}

export interface ZhiDaResponse {
  id?: string;
  model?: string;
  choices?: ZhiDaChoice[];
}
