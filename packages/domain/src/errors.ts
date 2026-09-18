export type DomainError =
  | {
      readonly code: 'revision.must_be_positive'
      readonly message: 'La revisión debe ser un entero positivo.'
    }
  | {
      readonly code: 'economic_activity.revenue_vat_treatment_other_required'
      readonly message: 'Describe el tratamiento de IVA cuando seleccionas “otro”.'
    }
  | {
      readonly code: 'taxpayer_profile.no_ruc_requires_no_vat_filing'
      readonly message: 'Un perfil sin RUC debe indicar que no tiene obligación de IVA.'
    }
  | {
      readonly code: 'taxpayer_profile.no_ruc_cannot_have_activities'
      readonly message: 'Un perfil sin RUC no puede incluir actividades económicas.'
    }

export const revisionMustBePositive = (): DomainError => ({
  code: 'revision.must_be_positive',
  message: 'La revisión debe ser un entero positivo.',
})
export const revenueVatTreatmentOtherRequired = (): DomainError => ({
  code: 'economic_activity.revenue_vat_treatment_other_required',
  message: 'Describe el tratamiento de IVA cuando seleccionas “otro”.',
})
export const noRucRequiresNoVatFiling = (): DomainError => ({
  code: 'taxpayer_profile.no_ruc_requires_no_vat_filing',
  message: 'Un perfil sin RUC debe indicar que no tiene obligación de IVA.',
})
export const noRucCannotHaveActivities = (): DomainError => ({
  code: 'taxpayer_profile.no_ruc_cannot_have_activities',
  message: 'Un perfil sin RUC no puede incluir actividades económicas.',
})
