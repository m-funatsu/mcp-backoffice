/**
 * エコシステム統合設定ファイル
 * Ecosystem Integration Configuration
 * 
 * 各外部サービスとの統合設定を管理
 */

export interface IntegrationSettings {
  freee: {
    enabled: boolean;
    apiVersion: string;
    baseUrl: string;
    oauth: {
      authorizationUrl: string;
      tokenUrl: string;
      revokeUrl: string;
      scopes: string[];
    };
    rateLimit: {
      maxRequests: number;
      windowMs: number;
    };
    syncOptions: {
      autoSyncInterval: number; // minutes
      batchSize: number;
      retryAttempts: number;
      retryDelay: number; // milliseconds
    };
  };
  
  moneyforward: {
    enabled: boolean;
    apiVersion: string;
    baseUrl: string;
    oauth: {
      authorizationUrl: string;
      tokenUrl: string;
      scopes: string[];
    };
    rateLimit: {
      maxRequests: number;
      windowMs: number;
    };
  };
  
  slack: {
    enabled: boolean;
    apiVersion: string;
    baseUrl: string;
    oauth: {
      authorizationUrl: string;
      tokenUrl: string;
      scopes: string[];
    };
    webhooks: {
      verificationToken?: string;
      signingSecret?: string;
    };
    channels: {
      hrNotifications: string;
      approvals: string;
      alerts: string;
    };
  };
  
  teams: {
    enabled: boolean;
    apiVersion: string;
    baseUrl: string;
    oauth: {
      authorizationUrl: string;
      tokenUrl: string;
      tenant: string;
      scopes: string[];
    };
    webhooks: {
      incomingWebhookUrl?: string;
    };
  };
  
  jira: {
    enabled: boolean;
    apiVersion: string;
    baseUrl: string;
    cloudId?: string;
    oauth: {
      authorizationUrl: string;
      tokenUrl: string;
      scopes: string[];
      pkce: boolean;
    };
    project: {
      key: string;
      issueTypes: {
        task: string;
        bug: string;
        story: string;
      };
    };
    customFields: {
      hrEventField?: string;
      employeeIdField?: string;
    };
  };
  
  asana: {
    enabled: boolean;
    apiVersion: string;
    baseUrl: string;
    workspaceGid?: string;
    oauth: {
      authorizationUrl: string;
      tokenUrl: string;
      scopes: string[];
    };
    project: {
      gid?: string;
      teamGid?: string;
    };
    customFields: {
      hrEventFieldGid?: string;
      mapping?: Record<string, string>;
    };
  };
}

// デフォルト設定
export const defaultIntegrationSettings: IntegrationSettings = {
  freee: {
    enabled: false,
    apiVersion: '2020-06-15',
    baseUrl: 'https://api.freee.co.jp',
    oauth: {
      authorizationUrl: 'https://accounts.secure.freee.co.jp/public_api/authorize',
      tokenUrl: 'https://accounts.secure.freee.co.jp/public_api/token',
      revokeUrl: 'https://api.freee.co.jp/oauth/revoke',
      scopes: ['read', 'write']
    },
    rateLimit: {
      maxRequests: 300,
      windowMs: 60000 // 1分
    },
    syncOptions: {
      autoSyncInterval: 60, // 60分ごと
      batchSize: 100,
      retryAttempts: 3,
      retryDelay: 1000
    }
  },
  
  moneyforward: {
    enabled: false,
    apiVersion: 'v1',
    baseUrl: 'https://api.moneyforward.com',
    oauth: {
      authorizationUrl: 'https://auth.moneyforward.com/oauth/authorize',
      tokenUrl: 'https://auth.moneyforward.com/oauth/token',
      scopes: ['manage_account', 'manage_transaction']
    },
    rateLimit: {
      maxRequests: 200,
      windowMs: 60000
    }
  },
  
  slack: {
    enabled: false,
    apiVersion: 'v1',
    baseUrl: 'https://slack.com/api',
    oauth: {
      authorizationUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      scopes: ['chat:write', 'channels:read', 'users:read', 'users.profile:write']
    },
    webhooks: {
      verificationToken: process.env.SLACK_VERIFICATION_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET
    },
    channels: {
      hrNotifications: '#hr-notifications',
      approvals: '#approvals',
      alerts: '#system-alerts'
    }
  },
  
  teams: {
    enabled: false,
    apiVersion: 'v1.0',
    baseUrl: 'https://graph.microsoft.com',
    oauth: {
      authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      tenant: 'common',
      scopes: ['User.Read', 'Chat.ReadWrite', 'ChannelMessage.Send']
    },
    webhooks: {
      incomingWebhookUrl: process.env.TEAMS_WEBHOOK_URL
    }
  },
  
  jira: {
    enabled: false,
    apiVersion: '3',
    baseUrl: 'https://api.atlassian.com/ex/jira',
    cloudId: process.env.JIRA_CLOUD_ID,
    oauth: {
      authorizationUrl: 'https://auth.atlassian.com/authorize',
      tokenUrl: 'https://auth.atlassian.com/oauth/token',
      scopes: ['read:jira-work', 'write:jira-work'],
      pkce: true
    },
    project: {
      key: 'HR',
      issueTypes: {
        task: 'Task',
        bug: 'Bug',
        story: 'Story'
      }
    },
    customFields: {
      hrEventField: 'customfield_10001',
      employeeIdField: 'customfield_10002'
    }
  },
  
  asana: {
    enabled: false,
    apiVersion: '1.0',
    baseUrl: 'https://app.asana.com/api',
    workspaceGid: process.env.ASANA_WORKSPACE_GID,
    oauth: {
      authorizationUrl: 'https://app.asana.com/-/oauth_authorize',
      tokenUrl: 'https://app.asana.com/-/oauth_token',
      scopes: ['default']
    },
    project: {
      gid: process.env.ASANA_PROJECT_GID,
      teamGid: process.env.ASANA_TEAM_GID
    },
    customFields: {
      hrEventFieldGid: process.env.ASANA_HR_EVENT_FIELD_GID,
      mapping: {}
    }
  }
};

// 環境変数から設定を読み込む
export function loadIntegrationSettings(): IntegrationSettings {
  const settings = { ...defaultIntegrationSettings };
  
  // freee設定
  if (process.env.FREEE_ENABLED === 'true') {
    settings.freee.enabled = true;
    if (process.env.FREEE_CLIENT_ID && process.env.FREEE_CLIENT_SECRET) {
      // OAuth認証情報は別途管理
    }
  }
  
  // Slack設定
  if (process.env.SLACK_ENABLED === 'true') {
    settings.slack.enabled = true;
    if (process.env.SLACK_HR_CHANNEL) {
      settings.slack.channels.hrNotifications = process.env.SLACK_HR_CHANNEL;
    }
    if (process.env.SLACK_APPROVAL_CHANNEL) {
      settings.slack.channels.approvals = process.env.SLACK_APPROVAL_CHANNEL;
    }
  }
  
  // Teams設定
  if (process.env.TEAMS_ENABLED === 'true') {
    settings.teams.enabled = true;
    if (process.env.TEAMS_TENANT_ID) {
      settings.teams.oauth.tenant = process.env.TEAMS_TENANT_ID;
    }
  }
  
  // Jira設定
  if (process.env.JIRA_ENABLED === 'true') {
    settings.jira.enabled = true;
    if (process.env.JIRA_PROJECT_KEY) {
      settings.jira.project.key = process.env.JIRA_PROJECT_KEY;
    }
  }
  
  // Asana設定
  if (process.env.ASANA_ENABLED === 'true') {
    settings.asana.enabled = true;
  }
  
  return settings;
}

// 統合の初期化ヘルパー
export function getEnabledIntegrations(settings: IntegrationSettings): string[] {
  const enabled: string[] = [];
  
  if (settings.freee.enabled) enabled.push('freee');
  if (settings.moneyforward.enabled) enabled.push('moneyforward');
  if (settings.slack.enabled) enabled.push('slack');
  if (settings.teams.enabled) enabled.push('teams');
  if (settings.jira.enabled) enabled.push('jira');
  if (settings.asana.enabled) enabled.push('asana');
  
  return enabled;
}

// Webhook URLの生成
export function generateWebhookUrl(baseUrl: string, provider: string): string {
  return `${baseUrl}/api/webhooks/${provider}`;
}

// 設定検証
export function validateIntegrationSettings(settings: IntegrationSettings): string[] {
  const errors: string[] = [];
  
  // freee検証
  if (settings.freee.enabled) {
    if (!process.env.FREEE_CLIENT_ID) {
      errors.push('FREEE_CLIENT_ID is required when freee integration is enabled');
    }
    if (!process.env.FREEE_CLIENT_SECRET) {
      errors.push('FREEE_CLIENT_SECRET is required when freee integration is enabled');
    }
  }
  
  // Slack検証
  if (settings.slack.enabled) {
    if (!process.env.SLACK_BOT_TOKEN && !process.env.SLACK_CLIENT_ID) {
      errors.push('Either SLACK_BOT_TOKEN or SLACK_CLIENT_ID is required');
    }
  }
  
  // Teams検証
  if (settings.teams.enabled) {
    if (!process.env.TEAMS_CLIENT_ID) {
      errors.push('TEAMS_CLIENT_ID is required when Teams integration is enabled');
    }
    if (!process.env.TEAMS_CLIENT_SECRET) {
      errors.push('TEAMS_CLIENT_SECRET is required when Teams integration is enabled');
    }
  }
  
  // Jira検証
  if (settings.jira.enabled) {
    if (!settings.jira.cloudId && !process.env.JIRA_CLOUD_ID) {
      errors.push('JIRA_CLOUD_ID is required when Jira integration is enabled');
    }
  }
  
  // Asana検証
  if (settings.asana.enabled) {
    if (!settings.asana.workspaceGid && !process.env.ASANA_WORKSPACE_GID) {
      errors.push('ASANA_WORKSPACE_GID is required when Asana integration is enabled');
    }
  }
  
  return errors;
}