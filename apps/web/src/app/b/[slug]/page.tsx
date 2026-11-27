import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, PageTitle } from '@/components/ui';
import { bookingHref, getPublicBusiness } from '@/lib/business';
import { formatDuration, formatPrice, timezoneLabel } from '@/lib/format';

export async function generateMetadata({
  params,
}: PageProps<'/b/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);
  return {
    title: business.name,
    description: `Book online at ${business.name}.`,
  };
}

export default async function BusinessPage({ params }: PageProps<'/b/[slug]'>) {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);

  return (
    <Container>
      <PageTitle
        title={business.name}
        subtitle={`Choose a service to see the available times · ${timezoneLabel(business.timezone)}`}
      />

      {business.services.length === 0 ? (
        <p className="card p-6 text-stone-600">
          This business has no services to book yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {business.services.map((service) => {
            const staff = business.staff.filter((s) =>
              s.serviceIds.includes(service.id),
            );
            return (
              <li
                key={service.id}
                className="card flex flex-wrap items-center gap-4 p-5"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-xl font-medium">
                    {service.name}
                  </h2>
                  {service.description && (
                    <p className="mt-1 text-sm text-stone-600">
                      {service.description}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-stone-500">
                    {formatDuration(service.durationMin)} ·{' '}
                    {formatPrice(service.priceCents)}
                    {staff.length > 0 && (
                      <> · with {staff.map((s) => s.name).join(', ')}</>
                    )}
                  </p>
                </div>
                {staff.length > 0 ? (
                  <Link
                    href={bookingHref(slug, 'book', { service: service.id })}
                    className="btn-primary"
                  >
                    Book
                  </Link>
                ) : (
                  <span className="text-sm text-stone-400">Not available</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
