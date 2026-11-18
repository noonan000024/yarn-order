import React, { useState } from 'react';
import { Flower2, CheckCircle2, Clock, Scissors, Truck, PackageCheck } from 'lucide-react';
import { OrderStatus, ShippingStatus, TaskStatus } from '../types/studio';

interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  className = 'h-12 w-12',
}) => {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-lg border border-[#EDDCD9] bg-[#FAF1EC] text-[#C96A7E] ${className}`}
        aria-label={alt}
      >
        <Flower2 className="h-1/2 w-1/2 stroke-[1.6]" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`shrink-0 rounded-lg border border-[#EDDCD9] object-cover bg-[#FAF1EC] ${className}`}
    />
  );
};

type AnyStatus = OrderStatus | TaskStatus | ShippingStatus;

export const StatusLabel: React.FC<{ status: AnyStatus }> = ({ status }) => {
  const config: Record<
    AnyStatus,
    { icon: React.ReactNode; textColor: string }
  > = {
    'รอดำเนินการ': {
      icon: <Clock className="h-3.5 w-3.5 shrink-0" />,
      textColor: 'text-[#A67438]',
    },
    'รอถัก': {
      icon: <Clock className="h-3.5 w-3.5 shrink-0" />,
      textColor: 'text-[#A67438]',
    },
    'กำลังถัก': {
      icon: <Scissors className="h-3.5 w-3.5 shrink-0" />,
      textColor: 'text-[#B5566A]',
    },
    'พร้อมส่ง': {
      icon: <PackageCheck className="h-3.5 w-3.5 shrink-0" />,
      textColor: 'text-[#3E7255]',
    },
    'เตรียมส่ง': {
      icon: <PackageCheck className="h-3.5 w-3.5 shrink-0" />,
      textColor: 'text-[#A67438]',
    },
    'ส่งบางส่วน': {
      icon: <Truck className="h-3.5 w-3.5 shrink-0" />,
      textColor: 'text-[#C26D4D]',
    },
    'กำลังจัดส่ง': {
      icon: <Truck className="h-3.5 w-3.5 shrink-0" />,
      textColor: 'text-[#B5566A]',
    },
    'ส่งครบแล้ว': {
      icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />,
      textColor: 'text-[#3E7255]',
    },
    'ส่งสำเร็จแล้ว': {
      icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />,
      textColor: 'text-[#3E7255]',
    },
  };

  const style = config[status] || {
    icon: <Clock className="h-3.5 w-3.5 shrink-0" />,
    textColor: 'text-[#7A6368]',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${style.textColor}`}>
      {style.icon}
      <span>{status}</span>
    </span>
  );
};
