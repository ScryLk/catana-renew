import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { useStudioStore } from '../../store/studioStore';
import { fetchDocumentAsset, protectedDocumentAssetPath } from '../../services/documentImportService';
import type { DocumentSnapshot } from '../../types/documentImport';
import { isSafeImageUrl } from '../../utils/imagePolicy';

export function ProtectedDocumentImage({snapshot, alt, ...props}: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {snapshot: Pick<DocumentSnapshot, 'url'> & Partial<DocumentSnapshot>}) {
  const user = useStudioStore(state => state.activeUserId);
  const org = useStudioStore(state => state.activeOrganizationId);
  const url = snapshot.url;
  const [resource, setResource] = useState<{key: string; url?: string; status: 'pending' | 'ready' | 'error'}>({key: '', status: 'pending'});
  const key = `${user}:${org}:${url}:${snapshot.hash}`;
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    let disposed = false;
    const path = protectedDocumentAssetPath(url);
    setResource({key, status: 'pending'});
    if (!path) {
      setResource(isSafeImageUrl(url) ? {key, url, status: 'pending'} : {key, status: 'error'});
    } else {
      void fetchDocumentAsset({url}, controller.signal).then(blob => {
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        setResource({key, url: objectUrl, status: 'pending'});
      }).catch(() => { if (!disposed) setResource({key, status: 'error'}); });
    }
    return () => { disposed = true; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [key, url]);
  const current = resource.key === key ? resource : {url: undefined, status: 'pending' as const};
  if (!current.url) return <div data-document-asset-state={current.status} role={current.status === 'error' ? 'alert' : 'status'} className={props.className} style={props.style}>{current.status === 'error' ? 'Não foi possível carregar a página original.' : <span className="sr-only">Carregando página original…</span>}</div>;
  return <img {...props} src={current.url} alt={alt} data-document-asset-state={current.status}
    onLoad={event => { setResource(value => value.key === key ? {...value, status: 'ready'} : value); props.onLoad?.(event); }}
    onError={event => { setResource(value => value.key === key ? {...value, status: 'error'} : value); props.onError?.(event); }} />;
}
