import os
import shutil
from PIL import Image

CLIENT_ASSETS = 'client/public/assets'
ADMIN_ASSETS = 'admin/public/assets'
BACKUP_DIR = 'temp_image_backups'

def get_target_max_dimension(rel_path):
    rel_path = rel_path.replace('\\', '/')
    if '/hero/' in rel_path or '/banners/' in rel_path:
        return 1920
    elif '/products/' in rel_path or '/rentals/' in rel_path:
        return 1600
    elif '/collections/' in rel_path or '/craftsmanship/' in rel_path or '/editorial/' in rel_path or '/brand/' in rel_path:
        return 1400
    elif '/testimonials/' in rel_path:
        return 600
    return 1400

def get_target_quality(rel_path):
    rel_path = rel_path.replace('\\', '/')
    if '/products/' in rel_path or '/rentals/' in rel_path:
        return 83 # High quality for fabric texture & stitching
    elif '/hero/' in rel_path or '/banners/' in rel_path:
        return 82
    elif '/testimonials/' in rel_path:
        return 84
    return 82

def optimize_image(src_path, backup_path, max_dim, quality):
    # Ensure backup
    os.makedirs(os.path.dirname(backup_path), exist_ok=True)
    if not os.path.exists(backup_path):
        shutil.copy2(src_path, backup_path)
    
    with Image.open(backup_path) as img:
        orig_w, orig_h = img.size
        orig_size = os.path.getsize(backup_path)
        icc = img.info.get('icc_profile')
        
        # Calculate new dimensions preserving aspect ratio
        w, h = orig_w, orig_h
        if max(orig_w, orig_h) > max_dim:
            if orig_w >= orig_h:
                w = max_dim
                h = int(round(orig_h * (max_dim / orig_w)))
            else:
                h = max_dim
                w = int(round(orig_w * (max_dim / orig_h)))
            
            # Resample with high-quality LANCZOS filter
            img = img.resize((w, h), Image.Resampling.LANCZOS)
        
        save_kwargs = {
            'quality': quality,
            'method': 6, # Maximum compression effort
        }
        if icc:
            save_kwargs['icc_profile'] = icc
            
        ext = os.path.splitext(src_path)[1].lower()
        if ext == '.webp':
            img.save(src_path, 'WEBP', **save_kwargs)
        elif ext in ('.jpg', '.jpeg'):
            img.save(src_path, 'JPEG', quality=quality, optimize=True, progressive=True)
        elif ext == '.png':
            img.save(src_path, 'PNG', optimize=True)
            
        new_size = os.path.getsize(src_path)
        return orig_w, orig_h, orig_size, w, h, new_size

def process_directory(base_dir):
    results = []
    for root, dirs, files in os.walk(base_dir):
        for f in files:
            if f.lower().endswith(('.webp', '.jpg', '.jpeg', '.png')):
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, base_dir)
                backup_path = os.path.join(BACKUP_DIR, os.path.basename(base_dir), rel_path)
                
                max_dim = get_target_max_dimension(full_path)
                quality = get_target_quality(full_path)
                
                ow, oh, osize, nw, nh, nsize = optimize_image(full_path, backup_path, max_dim, quality)
                reduction = (1 - (nsize / osize)) * 100
                results.append({
                    'path': full_path.replace('\\', '/'),
                    'orig_dim': f'{ow}x{oh}',
                    'new_dim': f'{nw}x{nh}',
                    'orig_kb': osize / 1024,
                    'new_kb': nsize / 1024,
                    'reduction_pct': reduction
                })
    return results

if __name__ == '__main__':
    print('Starting Majestic Blazer image optimization...')
    client_res = process_directory(CLIENT_ASSETS)
    
    # Mirror optimized client assets directly to admin assets
    print('Mirroring optimized assets to admin/public/assets...')
    for root, dirs, files in os.walk(CLIENT_ASSETS):
        for f in files:
            src = os.path.join(root, f)
            rel = os.path.relpath(src, CLIENT_ASSETS)
            dest = os.path.join(ADMIN_ASSETS, rel)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copy2(src, dest)
            
    print(f'\nOptimized {len(client_res)} assets:')
    total_orig = sum(r['orig_kb'] for r in client_res)
    total_new = sum(r['new_kb'] for r in client_res)
    
    client_res.sort(key=lambda x: x['orig_kb'] - x['new_kb'], reverse=True)
    for r in client_res[:15]:
        print(f"✓ {r['path']}: {r['orig_dim']} ({r['orig_kb']:.1f} KB) -> {r['new_dim']} ({r['new_kb']:.1f} KB) [-{r['reduction_pct']:.1f}%]")
        
    print(f"\n=======================================================")
    print(f"Total Client Original Size: {total_orig / 1024:.2f} MB")
    print(f"Total Client Optimized Size: {total_new / 1024:.2f} MB")
    print(f"Total Client Reduction: {((total_orig - total_new) / total_orig) * 100:.1f}%")
    print(f"Total Saved (Client + Admin): {((total_orig - total_new) * 2) / 1024:.2f} MB")
    print(f"=======================================================")
