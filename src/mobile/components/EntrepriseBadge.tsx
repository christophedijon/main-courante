import { useEntreprise } from '../../hooks/useEntreprise';

export default function EntrepriseBadge() {
  const { nom, logo_url } = useEntreprise();

  if (!nom && !logo_url) return null;

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {logo_url && (
        <img
          src={logo_url}
          alt={nom ?? 'Logo'}
          className="h-6 w-auto max-w-[40px] object-contain rounded-md"
        />
      )}
      {nom && (
        <span className="text-slate-400 text-[11px] font-medium truncate max-w-[80px]">
          {nom}
        </span>
      )}
    </div>
  );
}
