export type Role = 'customer' | 'pharmacist' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  address: string | null;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  color: string;
  productCount: number;
}

export interface Product {
  id: number;
  name: string;
  genericName: string | null;
  description: string | null;
  categoryId: number | null;
  categoryName?: string;
  categorySlug?: string;
  categoryColor?: string;
  categoryIcon?: string;
  manufacturer: string | null;
  dosageForm: string | null;
  strength: string | null;
  packSize: string | null;
  /** In pesewas (minor unit). */
  price: number;
  stock: number;
  requiresPrescription: boolean;
  imageUrl: string | null;
  featured: boolean;
  active: boolean;
}

export type OrderStatus =
  | 'awaiting_prescription'
  | 'pending_payment'
  | 'processing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'paystack' | 'cash_on_delivery';
export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded';

export interface OrderItem {
  id: number;
  productId: number | null;
  name: string;
  unitPrice: number;
  quantity: number;
  requiresPrescription: boolean;
}

export interface Order {
  id: number;
  userId: number;
  customerName?: string;
  customerEmail?: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference: string | null;
  paidAt: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryName: string;
  deliveryPhone: string;
  deliveryAddress: string;
  notes: string | null;
  prescriptionId: number | null;
  prescriptionStatus: PrescriptionStatus | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export type PrescriptionStatus = 'pending' | 'approved' | 'rejected';

export interface Prescription {
  id: number;
  userId: number;
  userName?: string;
  userEmail?: string;
  patientName: string | null;
  doctorName: string | null;
  notes: string | null;
  status: PrescriptionStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  imageUrl: string;
  orders?: { id: number; status: OrderStatus; total: number }[];
}

export interface Quote {
  lines: {
    productId: number;
    name: string;
    unitPrice: number;
    quantity: number;
    requiresPrescription: boolean;
    lineTotal: number;
  }[];
  problems: { productId: number; message: string }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  requiresPrescription: boolean;
}

export interface StoreSettings {
  currency: string;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  demoPayments: boolean;
}

export interface AdminStats {
  revenue: number;
  revenueToday: number;
  totalOrders: number;
  ordersByStatus: Partial<Record<OrderStatus, number>>;
  pendingPrescriptions: number;
  customers: number;
  products: number;
  lowStock: Product[];
  recentOrders: Order[];
  topProducts: { name: string; quantity: number; revenue: number }[];
}
