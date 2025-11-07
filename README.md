# POS System with Supabase Integration

This is a React-based Point of Sale system that uses Supabase as the backend database and Supabase Storage for image management.

## Setup Instructions

1. Create a Supabase project at https://supabase.com/
2. Run the SQL schema from `supabase_schema.sql` in your Supabase SQL editor
3. Create a storage bucket named `POS` in your Supabase project
4. Update the `.env` file with your Supabase project URL and anon key:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
5. Install dependencies:
   ```
   npm install
   ```
6. Run the development server:
   ```
   npm run dev
   ```

## Features

- POS interface for taking orders
- Kitchen display system
- Menu management with image uploads (using Supabase Storage)
- Reporting dashboard
- Supabase integration for data persistence
- Expense and income tracking

## Supabase Tables

The system uses the following tables:
- `menu_categories` - Menu categories
- `menu_items` - Menu items
- `orders` - Order records
- `order_items` - Individual items in orders
- `kitchen_tickets` - Kitchen order tickets
- `expenses` - Expense tracking
- `income` - Additional income tracking

## Supabase Storage

The system uses Supabase Storage for managing images:
- Storage bucket: `POS`
- Folder structure:
  - `pos_menu_items` - Menu item images
  - `pos_menu_items/thumbnails` - Thumbnail images
  - `pos_categories` - Category images
  - `pos_uploads` - General uploads
  - `pos_test` - Test images

## Development

To start the development server:
```
npm run dev
```

To build for production:
```
npm run build
```