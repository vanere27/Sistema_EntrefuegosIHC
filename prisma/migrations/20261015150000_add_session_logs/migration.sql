CREATE TABLE "SessionLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutAt" TIMESTAMP(3),

    CONSTRAINT "SessionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SessionLog_userId_loginAt_idx" ON "SessionLog"("userId", "loginAt");
CREATE INDEX "SessionLog_loginAt_logoutAt_idx" ON "SessionLog"("loginAt", "logoutAt");

ALTER TABLE "SessionLog"
ADD CONSTRAINT "SessionLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
