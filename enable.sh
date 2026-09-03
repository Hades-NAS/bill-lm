gcloud config set project bill-lm

gcloud services enable cloudkms.googleapis.com

BILL_LM_KMS_LOCATION="us-central1"
BILL_LM_KMS_KEYRING="bill-lm-byok"
BILL_LM_KMS_KEY="byok-connections"

gcloud kms keyrings create "$BILL_LM_KMS_KEYRING" \
  --location "$BILL_LM_KMS_LOCATION"

gcloud kms keys create "$BILL_LM_KMS_KEY" \
  --location "$BILL_LM_KMS_LOCATION" \
  --keyring "$BILL_LM_KMS_KEYRING" \
  --purpose encryption
