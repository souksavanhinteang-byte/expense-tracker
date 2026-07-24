import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                ສະໝັກສຳເລັດ
              </CardTitle>
              <CardDescription>
                ກະລຸນາກວດອີເມວເພື່ອຢືນຢັນບັນຊີ
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                ຫຼັງຈາກຢືນຢັນບັນຊີແລ້ວ ທ່ານສາມາດເຂົ້າລະບົບໄດ້.
              </p>
              <Link
                href="/auth/login"
                className="mt-4 inline-block text-sm font-semibold text-emerald-700 underline"
              >
                ກັບໄປໜ້າເຂົ້າລະບົບ
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
