import type { Metadata } from 'next';
import { ActionForm } from '@/components/action-form';
import { getBusinessContext } from '@/lib/dashboard-server';
import { updateBusiness } from '../../actions';
import { BusinessFields } from '../../business-fields';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage({
  params,
}: PageProps<'/dashboard/[businessId]/settings'>) {
  const { businessId } = await params;
  const business = await getBusinessContext(businessId);
  const isOwner = business.role === 'OWNER';

  return (
    <section className="max-w-xl">
      <h2 className="mb-2 text-sm font-medium text-zinc-700">Business</h2>
      <div className="card p-6">
        {isOwner ? (
          <ActionForm
            action={updateBusiness.bind(null, business.id)}
            submitLabel="Save settings"
          >
            <BusinessFields business={business} />
            <p className="text-xs text-zinc-500">
              Changing the address breaks links shared with the old one.
              Changing the time zone keeps existing bookings at the same
              instant, but working hours are read in the new zone.
            </p>
          </ActionForm>
        ) : (
          <BusinessFields business={business} disabled />
        )}
      </div>
    </section>
  );
}
