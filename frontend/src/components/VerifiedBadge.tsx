import { BadgeCheck } from 'lucide-react';

interface Props {
  size?: 'sm' | 'md';
}

const VerifiedBadge = ({ size = 'sm' }: Props) => {
  const dim = size === 'md' ? 18 : 14;
  return (
    <span title="Verified user">
      <BadgeCheck size={dim} className="text-accent-cyan shrink-0" />
    </span>
  );
};

export default VerifiedBadge;
