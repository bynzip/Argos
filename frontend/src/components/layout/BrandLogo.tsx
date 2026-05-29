import { useCompanyProfile } from '../../hooks/useCore';

type BrandLogoProps = {
  size?: 'sm' | 'lg';
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const sizeClasses = {
  sm: 'h-9 w-9 rounded-lg text-[14px]',
  lg: 'h-16 w-16 rounded-2xl text-2xl',
};

const imagePadding = {
  sm: 'p-1.5',
  lg: 'p-2',
};

function resolveLogoUrl(logo?: string | null) {
  if (!logo) return null;
  if (logo.startsWith('http://') || logo.startsWith('https://') || logo.startsWith('data:')) {
    return logo;
  }
  return `${API_BASE_URL}${logo}`;
}

export default function BrandLogo({ size = 'sm' }: BrandLogoProps) {
  const { data: profile } = useCompanyProfile();
  const logoUrl = resolveLogoUrl(profile?.logo);

  if (logoUrl) {
    return (
      <div className={`${sizeClasses[size]} ${imagePadding[size]} grid place-items-center bg-white border border-[var(--gray-200)] shadow-sm overflow-hidden`}>
        <img
          src={logoUrl}
          alt={profile?.business_name || 'Argos'}
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} grid place-items-center bg-brand-gradient text-white font-black shadow-sm`}>
      <span className={size === 'lg' ? 'tracking-wider' : ''}>AR</span>
    </div>
  );
}
