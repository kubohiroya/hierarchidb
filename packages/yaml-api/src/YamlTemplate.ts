/** A single YAML file template entry. */
export interface YamlTemplate {
    templateId: string;
    displayName: string;
    fileName: string;
    schemaId: string;
}

/** All predefined YAML file templates (10 entries). */
export const YAML_TEMPLATES: readonly YamlTemplate[] = [
    { templateId: 'sources', displayName: 'Sources', fileName: 'sources.yml', schemaId: 'ide-gsm/sources' },
    { templateId: 'scenario', displayName: 'Scenario', fileName: 'scenario.yml', schemaId: 'ide-gsm/scenario' },
    { templateId: 'scenario-base', displayName: 'Scenario Base', fileName: 'scenario-base.yml', schemaId: 'ide-gsm/scenario' },
    { templateId: 'calib', displayName: 'Calibration', fileName: 'calib.yml', schemaId: 'ide-gsm/calib' },
    { templateId: 'remote', displayName: 'Remote', fileName: 'remote.yml', schemaId: 'ide-gsm/remote' },
    { templateId: 'remote-base', displayName: 'Remote Base', fileName: 'remote-base.yml', schemaId: 'ide-gsm/remote' },
    { templateId: 'ssh', displayName: 'SSH', fileName: 'ssh.yml', schemaId: 'ide-gsm/ssh' },
    { templateId: 'ssh-base', displayName: 'SSH Base', fileName: 'ssh-base.yml', schemaId: 'ide-gsm/ssh' },
    { templateId: 'ec2', displayName: 'EC2', fileName: 'ec2.yml', schemaId: 'ide-gsm/ec2' },
    { templateId: 'ec2-base', displayName: 'EC2 Base', fileName: 'ec2-base.yml', schemaId: 'ide-gsm/ec2' },
] as const;

/**
 * Look up a template by templateId.
 * Returns undefined when the templateId is not found.
 */
export function findYamlTemplate(templateId: string): YamlTemplate | undefined {
    const found = YAML_TEMPLATES.find((t) => t.templateId === templateId);
    return found;
}
