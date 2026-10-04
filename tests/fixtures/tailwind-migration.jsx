import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from '../../src/components/ui/button';
import { Input } from '../../src/components/ui/input';
import { Dialog, DialogContent, DialogTitle } from '../../src/components/ui/dialog';
import { Trigger as DialogTrigger } from '@radix-ui/react-dialog';
import '../../src/index.css';

if (!import.meta.env.DEV || !['localhost', '127.0.0.1'].includes(location.hostname)) throw new Error('Local only');
function Fixture() {
  const [open, setOpen] = useState(false);
  return <main className="mx-auto grid max-w-xl gap-4 p-4" dir="rtl">
    <Dialog open={open} onOpenChange={setOpen}>
    <Button data-testid="primary">زر أساسي</Button>
    <DialogTrigger asChild><Button variant="outline">فتح النافذة</Button></DialogTrigger>
    <Input aria-label="الاسم" />
    <div data-testid="face" className="aspect-13/24 w-52 rounded-lg bg-primary/10 shadow-xs" />
      <DialogContent aria-describedby={undefined} dir="rtl">
        <DialogTitle>فحص النافذة</DialogTitle>
        <Button onClick={() => setOpen(false)}>إغلاق النافذة</Button>
      </DialogContent>
    </Dialog>
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
