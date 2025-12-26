import React, { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { uploadToSupabaseStorage } from '../services/supabaseStorageService';

const SupabaseStorageManager = () => {
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);

  // Function to test Supabase Storage upload
  const testSupabaseStorageUpload = async () => {
    setIsTesting(true);
    try {
      toast({ title: "ข้อมูล", description: 'กำลังทดสอบการเชื่อมต่อกับ Supabase Storage...' });

      // Create a simple test image as base64
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#4F46E5';
      ctx.fillRect(0, 0, 100, 100);
      ctx.fillStyle = 'white';
      ctx.font = '16px Arial';
      ctx.fillText('ทดสอบ', 30, 55);

      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'test-image.png', { type: 'image/png' });

        try {
          // Upload to Supabase Storage
          const result = await uploadToSupabaseStorage(file, 'pos_test');
          toast({ title: "สำเร็จ", description: 'Supabase Storage connection successful! Test image uploaded.' });
          console.log('Test upload result:', result);
        } catch (error) {
          // Provide more specific error messages
          if (error.message.includes('permissions')) {
            toast({ title: "เกิดข้อผิดพลาด", description: 'Supabase Storage connection failed: ' + error.message, variant: "destructive" });
          } else {
            toast({ title: "เกิดข้อผิดพลาด", description: 'Supabase Storage connection failed. Please check your bucket policies in Supabase.', variant: "destructive" });
          }
          console.error('Test upload error:', error);
        } finally {
          setIsTesting(false);
        }
      }, 'image/png');
    } catch (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: 'Error creating test image: ' + error.message, variant: "destructive" });
      setIsTesting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">การจัดการ Supabase Storage</h2>

      <div className="space-y-4">
        <div className="p-4 bg-indigo-50 rounded-lg">
          <h3 className="font-bold text-indigo-800 mb-2">ทดสอบการเชื่อมต่อกับ Supabase Storage</h3>
          <p className="text-indigo-700 text-sm mb-3">
            คลิกปุ่มด้านล่างเพื่อทดสอบว่าสามารถอัปโหลดรูปภาพไปยัง Supabase Storage ได้หรือไม่
          </p>
          <button
            onClick={testSupabaseStorageUpload}
            disabled={isTesting}
            className={`px-4 py-2 rounded-lg transition-colors ${isTesting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
          >
            {isTesting ? 'กำลังทดสอบ...' : 'ทดสอบการอัปโหลด'}
          </button>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-bold text-gray-800 mb-2">โครงสร้างโฟลเดอร์</h3>
          <ul className="text-gray-700 text-sm space-y-1">
            <li>📁 pos_menu_items - รูปภาพรายการเมนู</li>
            <li>📁 pos_menu_items/thumbnails - รูปภาพขนาดย่อ</li>
            <li>📁 pos_categories - รูปภาพหมวดหมู่</li>
            <li>📁 pos_uploads - การอัปโหลดทั่วไป</li>
            <li>📁 pos_test - สำหรับการทดสอบ</li>
          </ul>
        </div>

        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
          <h3 className="font-bold text-amber-800 mb-2">ข้อกำหนดการตั้งค่า</h3>
          <p className="text-amber-700 text-sm">
            หากเกิดข้อผิดพลาดเรื่องสิทธิ์การเข้าถึง คุณต้องตั้งค่า bucket policy ใน Supabase Storage:
          </p>
          <ul className="text-amber-700 text-sm list-disc pl-5 mt-2 space-y-1">
            <li>เปิด Supabase Dashboard</li>
            <li>ไปที่ Storage → Buckets → POS</li>
            <li>ตั้งค่า Bucket Policy ให้อนุญาตให้ authenticated users หรือ public สามารถอัปโหลดไฟล์ได้</li>
          </ul>
        </div>

        <div className="p-4 bg-emerald-50 rounded-lg">
          <h3 className="font-bold text-emerald-800 mb-2">ข้อมูลการใช้งาน</h3>
          <p className="text-emerald-700 text-sm">
            Supabase Storage ถูกใช้แทน Cloudinary สำหรับการจัดเก็บรูปภาพในระบบ POS นี้<br />
            ใช้ bucket ชื่อ: <strong>POS</strong>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SupabaseStorageManager;