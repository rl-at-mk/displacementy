import {useEffect, useRef} from 'react';
import {softwareVersion} from '@/constants/softwareVersion';
import {CanvasSection} from './CanvasSection';
import {SettingsSection} from './SettingsSection';
import {useStore} from './store';

export function Generator() {
  // Apply the URL/random values once after mount. Doing this here (rather than
  // at store creation) keeps the first client render equal to the server render
  // so hydration succeeds; the values update immediately afterwards.
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    useStore.getState().initializeValues();
  }, []);

  return (
    <div className='mx-auto max-w-screen-2xl'>
      <header className='p-4'>
        <h1 className='text-2xl select-none sm:text-3xl'>Displacement Y</h1>
        <span className='text-xs text-white/50'>{`v${softwareVersion}`}</span>
      </header>
      <main className='flex flex-col gap-8 px-4 pb-4 sm:flex-row sm:gap-6'>
        <div className='relative flex-1'>
          <CanvasSection />
        </div>
        <div className='relative flex-1 lg:flex-2'>
          <SettingsSection />
        </div>
      </main>
      <footer className='p-4 pt-12 text-sm'>
        <FooterRow>
          <span>
            Created by{' '}
            <FooterLink href='https://github.com/satelllte'>
              @satelllte
            </FooterLink>
          </span>
        </FooterRow>
        <FooterRow>
          <FooterLink href='https://github.com/rl-at-mk/displacementy'>
            GitHub
          </FooterLink>
          <FooterLink href='https://github.com/rl-at-mk/displacementy/releases'>
            Version History
          </FooterLink>
        </FooterRow>
      </footer>
    </div>
  );
}

function FooterRow({children}: {readonly children: React.ReactNode}) {
  return <div className='flex items-center gap-2'>{children}</div>;
}

function FooterLink({
  href,
  children,
}: {
  readonly href: string;
  readonly children: string;
}) {
  return (
    <a
      className='underline focus:outline-hidden focus-visible:ring-2 focus-visible:ring-sky'
      rel='noopener noreferrer'
      target='_blank'
      href={href}
    >
      {children}
    </a>
  );
}
