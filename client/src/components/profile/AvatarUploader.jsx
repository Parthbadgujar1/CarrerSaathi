import { useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Camera, Trash2 } from 'lucide-react';
import { userApi } from '../../services/api';
import { useAuth } from '../../store/auth.store';
import { getErrorMessage } from '../../lib/http';
import { Avatar, Button } from '../ui';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const SIZE = 256;

/** Centre-crops the chosen image to a square and returns a compact JPEG data URL (≈15–30 KB). */
function toAvatarDataUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

/** Profile photo: pick, crop to a square, resize in the browser and save. */
export function AvatarUploader() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const input = useRef(null);

  const save = useMutation({
    mutationFn: (avatar) => userApi.updateProfile({ avatar }),
    onSuccess: (res, avatar) => {
      setUser(res.data.user);
      toast.success(avatar ? 'Profile photo updated.' : 'Profile photo removed.');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast.error('Please choose a JPEG, PNG or WebP image.');
    if (file.size > MAX_FILE_BYTES) return toast.error('Please choose an image smaller than 8 MB.');
    try {
      save.mutate(await toAvatarDataUrl(file));
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <section className="card row" style={{ '--gap': '18px', alignItems: 'center' }} aria-label="Profile photo">
      <Avatar name={user.name} src={user.avatar} size={88} />
      <div className="stack" style={{ '--gap': '8px' }}>
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Profile photo</h2>
        <p className="xs muted mb-0">JPEG, PNG or WebP. We crop it to a square and resize it for you.</p>
        <div className="row" style={{ '--gap': '8px' }}>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="avatar-file" onChange={onPick} />
          <Button size="sm" variant="primary" icon={Camera} loading={save.isPending} onClick={() => input.current?.click()}>
            {user.avatar ? 'Change photo' : 'Upload photo'}
          </Button>
          {user.avatar && (
            <Button size="sm" icon={Trash2} disabled={save.isPending} onClick={() => save.mutate('')}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
