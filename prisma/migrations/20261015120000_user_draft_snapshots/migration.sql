CREATE TABLE "UserDraftSnapshot" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDraftSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserDraftSnapshot_userId_createdAt_idx" ON "UserDraftSnapshot"("userId", "createdAt");

ALTER TABLE "UserDraftSnapshot"
ADD CONSTRAINT "UserDraftSnapshot_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
