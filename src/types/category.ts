export interface Category {
  id: string;
  name: string;
  description: string;
  image_url: string;
  created_at: string;
  order_position: number;
  is_featured: boolean;
  layout_type: string;
  is_visible?: boolean;
}